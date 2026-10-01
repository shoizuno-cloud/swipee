#!/usr/bin/env python3
"""Swipee — 依存ライブラリなし(Python標準のみ)のサーバー。
発見フィード: Deezer公開API(30秒プレビュー=サビ付近) / 連携: Spotify(プレイリスト作成・再生中取得)
永続化: DATABASE_URL があればPostgres(Render等のホスティング向け。再起動してもデータが消えない)、
       無ければローカルのdata.jsonファイル(手元で試す分には依存ライブラリ不要)。
"""
import ssl, base64, json, os, random, secrets, threading, time, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path

ROOT = Path(__file__).parent
PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "127.0.0.1")  # LAN公開は HOST=0.0.0.0
CID = os.environ.get("SPOTIFY_CLIENT_ID", "")
CSECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
REDIRECT = os.environ.get("SPOTIFY_REDIRECT_URI", f"http://127.0.0.1:{PORT}/auth/callback")
SCOPES = "user-read-currently-playing user-read-playback-state playlist-modify-private playlist-modify-public"
DB_FILE = ROOT / "data.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "")
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

# 値は翻訳キー。表示文言はクライアント側の辞書(app.js の I18N)で言語ごとに変換する。
GENRES = {"0": "all", "16": "jpop", "132": "pop", "152": "rock", "116": "rap",
          "165": "rnb", "113": "dance", "106": "electro", "85": "alternative", "129": "jazz", "chill": "chill"}
# Deezerにはジャンルとしての"Chill"が無いため、公開プレイリストから引く(id: "Chill Hits")
CHILL_PLAYLIST = "1976454162"

def feed(user, genre, q):
    tracks = []
    if q:
        j = dz("/search?limit=50&q=" + urllib.parse.quote(q)); tracks += (j or {}).get("data", [])
    else:
        if genre == "chill":
            j = dz(f"/playlist/{CHILL_PLAYLIST}/tracks?limit=100")
        else:
            j = dz(f"/chart/{int(genre)}/tracks?limit=100")
        tracks += (j or {}).get("data", [])
        likes = user["likes"][-5:]
        for l in random.sample(likes, min(2, len(likes))):  # 好みに寄せる: いいねした曲のアーティストradio
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

def make_playlist(u, name, tracks, desc=None):
    pl = {"id": secrets.token_hex(4), "name": name, "tracks": tracks, "ts": time.time(), "spotify_url": None, "spotify_id": None, "matched": 0, "pinned": False}
    if u.get("spotify"):
        uris = [x for x in (sp_match(u, t) for t in tracks) if x]
        pl["matched"] = len(uris)
        s, j = sp_api(u, "POST", "/me/playlists", {"name": name, "public": False, "description": desc or "Created with Swipee"})
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
    return {"id": f["id"], "name": f["name"], "spotify": bool(f.get("spotify")),
            "now": {"track": now["track"], "source": now["source"], "ago": int(time.time() - now["ts"])} if live else None}

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
            with LOCK:
                if uid is None or uid not in DB["users"]:  # Spotifyで新規ログイン/既存ログイン
                    uid = next((x["id"] for x in DB["users"].values() if x.get("spotify", {}).get("id") == prof.get("id")), None)
                    if not uid: uid = new_user(prof.get("display_name") or prof.get("id"))["id"]
                usr = DB["users"][uid]
                usr["spotify"] = {"id": prof.get("id"), "access": j["access_token"], "refresh": j["refresh_token"], "exp": time.time() + j["expires_in"]}
                save()
            return self.redirect("/", self.session_cookie(usr))
        if path.startswith("/api/"):
            return self.api_get(path, qs, u)
        f = ROOT / "public" / ("index.html" if path == "/" else path.lstrip("/"))
        if not f.resolve().is_relative_to((ROOT / "public").resolve()) or not f.is_file(): return self.send({"error": "not found"}, 404)
        b = f.read_bytes(); ct = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json"}.get(f.suffix, "application/octet-stream")
        self.send_response(200); self.send_header("Content-Type", ct + ("" if ct.startswith("image") else "; charset=utf-8")); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def api_get(self, path, qs, u):
        if path == "/api/config": return self.send({"spotify_configured": bool(CID), "genres": GENRES})
        if not u: return self.send({"error": "unauth"}, 401)
        if path == "/api/me": return self.send(me_json(u))
        if path == "/api/feed": return self.send(feed(u, qs.get("genre", ["0"])[0], qs.get("q", [""])[0].strip()))
        if path == "/api/preview":
            t = fresh_preview(qs.get("id", [""])[0]); return self.send(t or {"error": "not found"}, 200 if t else 404)
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
        if path == "/api/playlist":
            tracks = body.get("tracks") or []
            if body.get("mix"):  # 選んだ曲に似た曲を足して作る
                have = {t["id"] for t in tracks}
                for t in random.sample(tracks, min(5, len(tracks))):
                    for r in ((dz(f"/artist/{t['artist_id']}/radio") or {}).get("data", []))[:8]:
                        if r["id"] not in have and len(tracks) < int(body.get("size", 30)):
                            have.add(r["id"]); tracks.append(slim(r))
            if not tracks: return self.send({"error": "no_tracks_selected"}, 400)
            return self.send(make_playlist(u, (body.get("name") or "Swipee Mix")[:60], tracks, body.get("desc")))
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
