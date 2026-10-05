#!/usr/bin/env python3
"""Musiwipe — 依存ライブラリなし(Python標準のみ)のサーバー。
発見フィード: Deezer公開API(30秒プレビュー=サビ付近) / 連携: Spotify(プレイリスト作成・再生中取得)
永続化: DATABASE_URL があればPostgres(Render等のホスティング向け。再起動してもデータが消えない)、
       無ければローカルのdata.jsonファイル(手元で試す分には依存ライブラリ不要)。
"""
import ssl, base64, json, os, random, re, secrets, threading, time, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).parent
PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "127.0.0.1")  # LAN公開は HOST=0.0.0.0
CID = os.environ.get("SPOTIFY_CLIENT_ID", "")
CSECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
REDIRECT = os.environ.get("SPOTIFY_REDIRECT_URI", f"http://127.0.0.1:{PORT}/auth/callback")
SCOPES = "user-read-currently-playing user-read-playback-state playlist-modify-private playlist-modify-public"
DB_FILE = ROOT / "data.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")  # 設定すると /api/admin/feedback?token=... でフィードバック一覧を読める
LOCK = threading.RLock()

# ---------- 永続化(Postgres優先、無ければJSONファイル) ----------
_pg = None
if DATABASE_URL:
    try:
        import psycopg2
        _pg = psycopg2.connect(DATABASE_URL, sslmode="require")
        _pg.autocommit = True
        with _pg.cursor() as c:
            c.execute("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        print("→ 永続化: Postgres")
    except Exception as e:
        print(f"! Postgres接続に失敗、data.jsonにフォールバックします: {e}")
        _pg = None

def _load_db():
    if _pg:
        with _pg.cursor() as c:
            c.execute("SELECT value FROM kv WHERE key = 'db'")
            row = c.fetchone()
            if row: return json.loads(row[0])
        return {"users": {}, "sessions": {}}
    return json.loads(DB_FILE.read_text()) if DB_FILE.exists() else {"users": {}, "sessions": {}}

DB = _load_db()
STATES = {}

def save():
    with LOCK:
        body = json.dumps(DB, ensure_ascii=False)
        if _pg:
            with _pg.cursor() as c:
                c.execute("INSERT INTO kv (key, value) VALUES ('db', %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", (body,))
        else:
            DB_FILE.write_text(body)

def _ctx():
    try:
        import certifi; return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        c = ssl.create_default_context()
        for f in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
            if os.path.exists(f): c.load_verify_locations(f)
        return c
CTX = _ctx()

def http(url, data=None, headers=None, method=None, form=False):
    h = dict(headers or {})
    body = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode(); h["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode(); h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, body, h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15, context=CTX) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {"error": raw.decode(errors="replace")[:300]}
    except Exception as e:
        return 0, {"error": str(e)}

# ---------- Deezer ----------
def dz(path):
    s, j = http("https://api.deezer.com" + path)
    return j if s == 200 and j and "error" not in j else None

def slim(t):
    return {"id": t["id"], "title": t.get("title_short") or t["title"], "artist": t["artist"]["name"],
            "artist_id": t["artist"]["id"], "cover": (t.get("album") or {}).get("cover_medium", ""),
            "preview": t.get("preview", ""), "link": t.get("link", "")}

# 値は翻訳キー。表示文言はクライアント側の辞書(app.js の LANGS)で言語ごとに変換する。
GENRES = {"0": "all", "jpop": "jpop", "kpop": "kpop", "pop": "pop", "rock": "rock", "rap": "rap", "rnb": "rnb",
          "dance": "dance", "electro": "electro", "alternative": "alternative", "jazz": "jazz", "chill": "chill", "viral": "viral"}
# Deezerのジャンル別チャートは別ジャンルの曲が混ざる(例: "Asian Music"は実質K-POPのみ、RockにMichael Jackson等)ため、
# ジャンルの編集部プレイリストから曲を引く。複数あれば合算する。
GENRE_PLAYLISTS = {
    "jpop": [6049895724, 13238096463, 11911629401],  # Top J-Pop / 2024 J-Pop / 2023 J-pop (Deezer Japan Editor)
    "kpop": [4096400722, 12244134951],               # Top K-Pop / New K-Pop (Deezer K-Pop Editor)
    "rock": [752286631, 1419215845],                 # Rock Hits / 2000s Rock (Deezer Rock Editor)
    "rap": [1677006641, 1996494362],                 # Hot Urban / Rap Bangers (Deezer Rap Editor)
    "rnb": [1999466402, 5411628342],                 # R&B Hits / 2010s R&B (Deezer R&B Editor)
    "dance": [706093725, 2249258602],                # Global Dance Hits / New Dance (Deezer Dance & EDM Editor)
    "electro": [1902101402],                         # Electronic Hits (Deezer Dance & EDM Editor)
    "alternative": [7966514882],                     # Alt Trends (Deezer Alternative Editor)
    "jazz": [1615514485, 5898527324],                # Jazz Essentials / Jazz Club (Deezer Jazz & Blues Editor)
    "chill": [1976454162],                           # Chill Hits
    "viral": [4403076402],                           # TikTok Hits World
}
# プレイリストが取得できない(削除された等)場合や、編集部プレイリストが無いジャンルはチャートにフォールバック
GENRE_CHART = {"pop": 132, "kpop": 16, "rock": 152, "rap": 116, "rnb": 165, "dance": 113, "electro": 106, "alternative": 85, "jazz": 129}

PL_CACHE = {}
def dz_cached(path, ttl=300):
    """プレイリスト/チャートは5分キャッシュ(フィード取得のたびにDeezerへ並列リクエストが飛ぶのを避ける)。プレビューURLの有効期限より短い"""
    hit = PL_CACHE.get(path)
    if hit and time.time() - hit[0] < ttl: return hit[1]
    j = dz(path)
    if j:
        if len(PL_CACHE) > 200: PL_CACHE.clear()
        PL_CACHE[path] = (time.time(), j)
    return j

def genre_tracks(genre):
    paths = [f"/playlist/{pid}/tracks?limit=100" for pid in GENRE_PLAYLISTS.get(genre, [])]
    if not paths:
        paths = [f"/chart/{GENRE_CHART.get(genre, int(genre) if genre.isdigit() else 0)}/tracks?limit=100"]
    with ThreadPoolExecutor(len(paths)) as ex: res = list(ex.map(dz_cached, paths))
    tracks = [t for r in res for t in (r or {}).get("data", [])]
    if not tracks and genre in GENRE_CHART:
        tracks = (dz_cached(f"/chart/{GENRE_CHART[genre]}/tracks?limit=100") or {}).get("data", [])
    return tracks

def playable(tracks, limit=40):
    """プレビューのある曲だけを、順序を保ったまま重複(同ID/同タイトル同アーティスト)なしで返す。検索結果は関連度順を崩さない"""
    out, ids, names = [], set(), set()
    for t in tracks:
        nk = ((t.get("title_short") or t["title"]).lower(), t["artist"]["name"].lower())
        if t["id"] in ids or nk in names or not t.get("preview"): continue
        ids.add(t["id"]); names.add(nk); out.append(slim(t))
    return out[:limit]

def version_key(t):
    """リミックス/カバー/"- From THE FIRST TAKE"等の派生版を同じ曲として扱うためのキー"""
    title = re.sub(r"[\(\[（【].*?[\)\]）】]", "", t.get("title_short") or t["title"])
    title = re.split(r"\s[-–—]\s", title)[0]
    return re.sub(r"\s+", " ", title).strip().lower(), t["artist"]["name"].lower()

def suggest(q):
    """入力中の候補: アーティスト(ファン数順) + 曲。Deezerのオートコンプリートと検索を並列に引いて合成する"""
    quoted = urllib.parse.quote(q)
    with ThreadPoolExecutor(2) as ex:
        f_auto = ex.submit(dz, "/search/autocomplete?limit=20&q=" + quoted)
        f_art = ex.submit(dz, "/search/artist?limit=50&q=" + quoted)
        auto, arts = f_auto.result() or {}, f_art.result() or {}
    ql = q.lower()
    cand = {}
    for a in ((auto.get("artists") or {}).get("data") or []) + (arts.get("data") or []):
        n = a["name"].lower()
        if ql in n and (n not in cand or a.get("nb_fan", 0) > cand[n].get("nb_fan", 0)): cand[n] = a
    top = [a for a in sorted(cand.values(), key=lambda a: -a.get("nb_fan", 0)) if a.get("nb_fan", 0) >= 100][:2]
    out = [{"kind": "artist", "id": a["id"], "name": a["name"], "picture": a.get("picture_small") or a.get("picture_medium", "")} for a in top]
    tracks = []
    if top and top[0]["name"].lower().startswith(ql):  # アーティスト名を打っている最中: その人の人気曲を先頭に
        tracks += ((dz(f"/artist/{top[0]['id']}/top?limit=5") or {}).get("data") or [])
    tracks += (auto.get("tracks") or {}).get("data") or (dz("/search?limit=20&q=" + quoted) or {}).get("data", [])
    seen, n = set(), 0
    for t in tracks:
        if not t.get("preview"): continue
        k = version_key(t)
        if k in seen: continue
        seen.add(k); out.append({"kind": "track", **slim(t)}); n += 1
        if n >= 7: break
    return out

SUG_CACHE = {}
def suggest_cached(q, ttl=600):
    """同じ入力は10分間使い回す(打ち直し・消して再入力でのDeezer呼び出しと待ち時間を減らす)。プレビューURLの有効期限より十分短い"""
    k, now = q.lower(), time.time()
    hit = SUG_CACHE.get(k)
    if hit and now - hit[0] < ttl: return hit[1]
    res = suggest(q)
    if len(SUG_CACHE) > 500: SUG_CACHE.clear()
    if res: SUG_CACHE[k] = (now, res)  # 一時的な失敗(空)は覚えない
    return res

def artist_feed(aid):
    j = dz(f"/artist/{int(aid)}/top?limit=50")
    return playable((j or {}).get("data", []))

def feed(user, genre, q):
    tracks = []
    if q:
        j = dz("/search?limit=50&q=" + urllib.parse.quote(q))
        return playable((j or {}).get("data", []))
    else:
        tracks += genre_tracks(genre)
        if genre == "0":  # 好みに寄せるのは「すべて」だけ(ジャンル指定時にradioを混ぜると別ジャンルの曲が入るため)
            likes = user["likes"][-5:]
            for l in random.sample(likes, min(2, len(likes))):  # いいねした曲のアーティストradio
                j = dz(f"/artist/{l['artist_id']}/radio"); tracks += (j or {}).get("data", [])
    seen = {l["id"] for l in user["likes"]}
    out, ids = [], set()
    for t in tracks:
        if t["id"] in seen or t["id"] in ids or not t.get("preview"): continue
        ids.add(t["id"]); out.append(slim(t))
    random.shuffle(out)
    return out[:40]

def fresh_preview(tid):
    j = dz(f"/track/{tid}")
    return slim(j) if j else None

# ---------- Spotify ----------
def spotify_token(u):
    sp = u.get("spotify")
    if not sp: return None
    if time.time() > sp["exp"] - 60:
        s, j = http("https://accounts.spotify.com/api/token", {"grant_type": "refresh_token", "refresh_token": sp["refresh"]},
                    {"Authorization": "Basic " + base64.b64encode(f"{CID}:{CSECRET}".encode()).decode()}, form=True)
        if s != 200: return None
        sp["access"] = j["access_token"]; sp["exp"] = time.time() + j["expires_in"]
        sp["refresh"] = j.get("refresh_token", sp["refresh"]); save()
    return sp["access"]

def sp_api(u, method, path, data=None):
    tok = spotify_token(u)
    if not tok: return 401, {"error": "spotify_not_linked"}
    return http("https://api.spotify.com/v1" + path, data, {"Authorization": "Bearer " + tok}, method)

def sp_match(u, t):
    full = dz(f"/track/{t['id']}") or {}
    isrc = full.get("isrc")
    if isrc:
        s, j = sp_api(u, "GET", "/search?type=track&limit=1&q=" + urllib.parse.quote("isrc:" + isrc))
        items = ((j or {}).get("tracks") or {}).get("items") or []
        if items: return items[0]["uri"]
    q = f'track:{t["title"]} artist:{t["artist"]}'
    s, j = sp_api(u, "GET", "/search?type=track&limit=1&q=" + urllib.parse.quote(q))
    items = ((j or {}).get("tracks") or {}).get("items") or []
    return items[0]["uri"] if items else None

def make_playlist(u, name, tracks, desc=None, public=False):
    pl = {"id": secrets.token_hex(4), "name": name, "tracks": tracks, "ts": time.time(), "spotify_url": None, "spotify_id": None, "matched": 0, "pinned": False, "public": bool(public)}
    if u.get("spotify"):
        uris = [x for x in (sp_match(u, t) for t in tracks) if x]
        pl["matched"] = len(uris)
        s, j = sp_api(u, "POST", "/me/playlists", {"name": name, "public": False, "description": desc or "Created with Musiwipe"})
        if s in (200, 201) and uris:
            pl["spotify_url"] = j["external_urls"]["spotify"]; pl["spotify_id"] = j["id"]
            for i in range(0, len(uris), 100):
                s2, _ = sp_api(u, "POST", f"/playlists/{j['id']}/items", {"uris": uris[i:i+100]})
                if s2 not in (200, 201): sp_api(u, "POST", f"/playlists/{j['id']}/tracks", {"uris": uris[i:i+100]})
        elif s not in (200, 201):
            pl["error"] = "playlist_create_failed"
    u["playlists"].append(pl); save()
    return pl

def poller():
    """Spotify連携ユーザーの再生中を定期取得 → 友達に共有"""
    while True:
        time.sleep(15)
        for u in list(DB["users"].values()):
            if not u.get("spotify") or not u.get("share", True): continue
            try:
                s, j = sp_api(u, "GET", "/me/player/currently-playing")
                if s == 200 and j and j.get("is_playing") and j.get("item"):
                    it = j["item"]
                    cur = u.get("now") or {}
                    if cur.get("sp_id") == it["id"] and cur.get("source") == "spotify":
                        cur["ts"] = time.time(); continue
                    track = {"title": it["name"], "artist": ", ".join(a["name"] for a in it["artists"]),
                             "cover": (it["album"]["images"] or [{}])[-1].get("url", ""), "id": None, "preview": "", "artist_id": None}
                    d = dz("/track/isrc:" + it.get("external_ids", {}).get("isrc", "x"))
                    if d: track.update(slim(d))
                    u["now"] = {"track": track, "ts": time.time(), "source": "spotify", "sp_id": it["id"]}; save()
                elif s == 204 and (u.get("now") or {}).get("source") == "spotify":
                    u["now"]["ts"] = 0; save()
            except Exception as e:
                print("poll err", e)

# ---------- HTTP ----------
def me_json(u):
    return {"id": u["id"], "name": u["name"], "code": u["code"], "spotify": bool(u.get("spotify")), "share": u.get("share", True),
            "likes": u["likes"], "playlists": u["playlists"][::-1]}

def friend_json(f):
    now = f.get("now")
    live = bool(now) and time.time() - now["ts"] < (60 if now["source"] == "spotify" else 600)
    pls = [{"id": p["id"], "name": p["name"], "tracks": p["tracks"], "spotify_url": p.get("spotify_url")}
           for p in f["playlists"] if p.get("public")]
    return {"id": f["id"], "name": f["name"], "spotify": bool(f.get("spotify")),
            "now": {"track": now["track"], "source": now["source"], "ago": int(time.time() - now["ts"])} if live else None,
            "playlists": pls}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def user(self):
        c = SimpleCookie(self.headers.get("Cookie", ""))
        sid = c["sid"].value if "sid" in c else None
        return DB["users"].get(DB["sessions"].get(sid)) if sid else None
    def send(self, obj, code=200, headers=None):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8")
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def redirect(self, to, cookie=None):
        self.send_response(302); self.send_header("Location", to)
        if cookie: self.send_header("Set-Cookie", cookie)
        self.end_headers()
    def session_cookie(self, u):
        sid = secrets.token_urlsafe(24); DB["sessions"][sid] = u["id"]; save()
        return f"sid={sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"

    def do_GET(self):
        p = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(p.query); path = p.path
        u = self.user()
        if path == "/auth/login":
            if not CID: return self.send({"error": "spotify_not_configured"}, 400)
            st = secrets.token_urlsafe(12); STATES[st] = u["id"] if u else None
            return self.redirect("https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(
                {"client_id": CID, "response_type": "code", "redirect_uri": REDIRECT, "scope": SCOPES, "state": st}))
        if path == "/auth/callback":
            uid = STATES.pop(qs.get("state", [""])[0], "missing")
            if uid == "missing" or "code" not in qs: return self.redirect("/?err=auth")
            s, j = http("https://accounts.spotify.com/api/token", {"grant_type": "authorization_code", "code": qs["code"][0], "redirect_uri": REDIRECT},
                        {"Authorization": "Basic " + base64.b64encode(f"{CID}:{CSECRET}".encode()).decode()}, form=True)
            if s != 200: return self.redirect("/?err=token")
            s, prof = http("https://api.spotify.com/v1/me", headers={"Authorization": "Bearer " + j["access_token"]})
            is_new = False
            with LOCK:
                if uid is None or uid not in DB["users"]:  # Spotifyで新規ログイン/既存ログイン
                    uid = next((x["id"] for x in DB["users"].values() if x.get("spotify", {}).get("id") == prof.get("id")), None)
                    if not uid: uid = new_user(prof.get("display_name") or prof.get("id"))["id"]; is_new = True
                usr = DB["users"][uid]
                usr["spotify"] = {"id": prof.get("id"), "access": j["access_token"], "refresh": j["refresh_token"], "exp": time.time() + j["expires_in"]}
                save()
            return self.redirect("/?welcome=1" if is_new else "/", self.session_cookie(usr))
        if path.startswith("/api/"):
            return self.api_get(path, qs, u)
        f = ROOT / "public" / ("index.html" if path == "/" else path.lstrip("/"))
        if not f.resolve().is_relative_to((ROOT / "public").resolve()) or not f.is_file(): return self.send({"error": "not found"}, 404)
        b = f.read_bytes(); ct = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json"}.get(f.suffix, "application/octet-stream")
        cache = "no-cache" if f.suffix in (".html", ".js", ".css", ".webmanifest") else "public, max-age=86400"  # コード更新がブラウザキャッシュで古いまま残らないように
        self.send_response(200); self.send_header("Content-Type", ct + ("" if ct.startswith("image") else "; charset=utf-8")); self.send_header("Cache-Control", cache); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def api_get(self, path, qs, u):
        if path == "/api/config": return self.send({"spotify_configured": bool(CID), "genres": GENRES})
        if path == "/api/admin/feedback":
            tok = qs.get("token", [""])[0]
            if not ADMIN_TOKEN or not secrets.compare_digest(tok, ADMIN_TOKEN): return self.send({"error": "not found"}, 404)
            return self.send(DB.get("feedback", [])[::-1])
        if not u: return self.send({"error": "unauth"}, 401)
        if path == "/api/me": return self.send(me_json(u))
        if path == "/api/feed":
            if qs.get("artist"):
                try: return self.send(artist_feed(qs["artist"][0]))
                except ValueError: return self.send({"error": "not_found"}, 400)
            return self.send(feed(u, qs.get("genre", ["0"])[0], qs.get("q", [""])[0].strip()))
        if path == "/api/preview":
            t = fresh_preview(qs.get("id", [""])[0]); return self.send(t or {"error": "not found"}, 200 if t else 404)
        if path == "/api/suggest":
            q = qs.get("q", [""])[0].strip()
            return self.send(suggest_cached(q) if q else [])
        if path == "/api/friends":
            return self.send([friend_json(DB["users"][i]) for i in u["friends"] if i in DB["users"]])
        self.send({"error": "not found"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); body = json.loads(self.rfile.read(n) or b"{}")
        path = self.path; u = self.user()
        if path == "/api/login":
            name = (body.get("name") or "").strip()[:20]
            if not name: return self.send({"error": "name_required"}, 400)
            usr = new_user(name); return self.send({"ok": True}, headers={"Set-Cookie": self.session_cookie(usr)})
        if path == "/api/logout":
            return self.send({"ok": True}, headers={"Set-Cookie": "sid=; Path=/; Max-Age=0"})
        if not u: return self.send({"error": "unauth"}, 401)
        with LOCK:
            if path == "/api/like":
                t = body["track"]
                if not any(l["id"] == t["id"] for l in u["likes"]): u["likes"].append({**{k: t.get(k) for k in ("id", "title", "artist", "artist_id", "cover", "link")}, "pinned": False})
                save(); return self.send({"ok": True})
            if path == "/api/unlike":
                u["likes"] = [l for l in u["likes"] if l["id"] != body["id"]]; save(); return self.send({"ok": True})
            if path == "/api/pin":
                kind, pid, val = body.get("kind"), body.get("id"), bool(body.get("pinned"))
                items = u["likes"] if kind == "track" else u["playlists"] if kind == "playlist" else None
                if items is None: return self.send({"error": "not_found"}, 400)
                target = next((x for x in items if str(x["id"]) == str(pid)), None)
                if not target: return self.send({"error": "not_found"}, 404)
                target["pinned"] = val; save(); return self.send({"ok": True})
            if path == "/api/nowplaying":
                if u.get("spotify") and (u.get("now") or {}).get("source") == "spotify" and time.time() - u["now"]["ts"] < 60: return self.send({"ok": True})
                t = body["track"]; u["now"] = {"track": {k: t.get(k) for k in ("id", "title", "artist", "cover", "artist_id", "preview")}, "ts": time.time(), "source": "preview"}
                save(); return self.send({"ok": True})
            if path == "/api/share":
                u["share"] = bool(body.get("share"));
                if not u["share"]: u["now"] = None
                save(); return self.send({"ok": True})
            if path == "/api/profile":
                name = (body.get("name") or "").strip()[:20]
                if not name: return self.send({"error": "name_required"}, 400)
                u["name"] = name; save(); return self.send({"ok": True})
            if path == "/api/spotify/unlink":
                u["spotify"] = None
                if (u.get("now") or {}).get("source") == "spotify": u["now"] = None
                save(); return self.send({"ok": True})
            if path == "/api/account/delete":
                for fid in u["friends"]:
                    if fid in DB["users"]: DB["users"][fid]["friends"] = [x for x in DB["users"][fid]["friends"] if x != u["id"]]
                DB["sessions"] = {sid: uid for sid, uid in DB["sessions"].items() if uid != u["id"]}
                for f in DB.get("feedback", []):  # 退会時は投稿者を特定できる情報だけ消し、内容は改善のため残す
                    if f.get("uid") == u["id"]: f.update(uid=None, name="", contact="")
                del DB["users"][u["id"]]; save()
                return self.send({"ok": True}, headers={"Set-Cookie": "sid=; Path=/; Max-Age=0"})
            if path == "/api/friends/add":
                code = (body.get("code") or "").strip().upper()
                f = next((x for x in DB["users"].values() if x["code"] == code), None)
                if not f or f["id"] == u["id"]: return self.send({"error": "code_not_found"}, 404)
                for a, b in ((u, f), (f, u)):
                    if b["id"] not in a["friends"]: a["friends"].append(b["id"])
                save(); return self.send({"ok": True, "name": f["name"]})
            if path == "/api/friends/remove":
                fid = body["id"]
                u["friends"] = [x for x in u["friends"] if x != fid]
                if fid in DB["users"]: DB["users"][fid]["friends"] = [x for x in DB["users"][fid]["friends"] if x != u["id"]]
                save(); return self.send({"ok": True})
        if path == "/api/feedback":
            msg = (body.get("message") or "").strip()[:2000]
            if len(msg) < 3: return self.send({"error": "message_required"}, 400)
            now = time.time()
            with LOCK:
                fb = DB.setdefault("feedback", [])
                if sum(1 for f in fb if f.get("uid") == u["id"] and now - f["ts"] < 3600) >= 5: return self.send({"error": "rate_limited"}, 429)
                item = {"id": secrets.token_hex(4), "ts": now, "uid": u["id"], "name": u["name"],
                        "category": body.get("category") if body.get("category") in ("idea", "bug", "other") else "other",
                        "message": msg, "contact": (body.get("contact") or "").strip()[:200], "lang": str(body.get("lang") or "")[:8],
                        "ua": self.headers.get("User-Agent", "")[:200]}
                fb.append(item); save()
            print("FEEDBACK", json.dumps(item, ensure_ascii=False), flush=True)  # Renderのログからも読める
            return self.send({"ok": True})
        if path == "/api/playlist":
            tracks = body.get("tracks") or []
            if body.get("mix"):  # 選んだ曲に似た曲を足して作る
                have = {t["id"] for t in tracks}
                for t in random.sample(tracks, min(5, len(tracks))):
                    for r in ((dz(f"/artist/{t['artist_id']}/radio") or {}).get("data", []))[:8]:
                        if r["id"] not in have and len(tracks) < int(body.get("size", 30)):
                            have.add(r["id"]); tracks.append(slim(r))
            if not tracks: return self.send({"error": "no_tracks_selected"}, 400)
            return self.send(make_playlist(u, (body.get("name") or "Musiwipe Mix")[:60], tracks, body.get("desc"), body.get("public")))
        if path == "/api/playlist/visibility":
            with LOCK:
                pl = next((p for p in u["playlists"] if p["id"] == body.get("id")), None)
                if not pl: return self.send({"error": "not_found"}, 404)
                pl["public"] = bool(body.get("public")); save()
            return self.send({"ok": True})
        if path == "/api/playlist/delete":
            with LOCK:
                pl = next((p for p in u["playlists"] if p["id"] == body.get("id")), None)
                if not pl: return self.send({"error": "not_found"}, 404)
                if pl.get("spotify_id") and u.get("spotify"):  # Spotify側もフォロー解除(=削除)しておく。失敗してもローカルからは消す
                    sp_api(u, "DELETE", f"/playlists/{pl['spotify_id']}/followers")
                u["playlists"] = [p for p in u["playlists"] if p["id"] != pl["id"]]
                save()
            return self.send({"ok": True})
        self.send({"error": "not found"}, 404)

def new_user(name):
    with LOCK:
        uid = secrets.token_hex(6)
        u = DB["users"][uid] = {"id": uid, "name": name, "code": secrets.token_hex(3).upper(), "friends": [], "likes": [], "playlists": [], "now": None, "share": True}
        save(); return u

if __name__ == "__main__":
    threading.Thread(target=poller, daemon=True).start()
    print(f"→ http://127.0.0.1:{PORT}  (Spotify連携: {'ON' if CID else 'OFF - SPOTIFY_CLIENT_ID未設定'})")
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
