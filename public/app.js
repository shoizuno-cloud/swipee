const $ = s => document.querySelector(s), audio = $('#audio');
const api = async (p, body) => { const r = await fetch(p, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {}); if (r.status === 401) { showLogin(); throw 0 } const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error'); return j };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600) };
let me, queue = [], cur = null, reported = false, selected = new Set(), genresCfg = null;

// ---- 多言語(i18n) ----
const LANGS = {
  ja: {langName:'日本語', tagline:'サビだけ聴いて、好きな曲に出会う。<br>友達が今聴いている曲も見れる。', spotifyStart:'Spotifyで始める', orTry:'または(Spotify連携なしで試す)', nickname:'ニックネーム', start:'はじめる', searchPh:'アーティスト・曲名で探す', discoverHint:'← スキップ / → いいね / スペース 再生・停止 / Z やり直し (30秒プレビュー=サビ付近)', navDiscover:'発見', navLibrary:'ライブラリ', navFriends:'友達', whoSpotify:' · Spotify連携中', noTracksFound:'曲が見つかりません', tapToPlay:'▶ タップでサビ再生', likedAdded:'♥ ライブラリに追加', likeBadge:'いいね', skipBadge:'スキップ', nothingToUndo:'戻せる操作がありません', undoToast:'↩ 元に戻しました', libCreateTitle:'プレイリストを作る', plNamePh:'プレイリスト名', plDefaultPrefix:'Swipee', plDesc:'Swipeeで作成', mixLabel:'似た曲も自動で追加して30曲にする', mkBtnSpotify:'Spotifyにプレイリスト作成', mkBtnLocal:'プレイリスト作成', selectAllBtn:'全選択', deleteSelectedBtn:'選択した曲を削除', confirmDeleteSelected:'{n}曲を削除しますか?', notLinkedHint:'※Spotify未連携のためアプリ内に保存されます。', spotifyLinkText:'Spotifyと連携', likedTitle:'いいねした曲 ({n})', likedEmpty:'発見タブで♥を付けるとここに溜まります', deleteBtn:'削除', playlistsTitle:'作成したプレイリスト', trackCount:'{n}曲', matchedSuffix:' · Spotifyに{n}曲一致', playlistsEmpty:'まだありません', openBtn:'開く', creating:'作成中…', createdSpotify:'Spotifyに作成しました', createdLocal:'作成しました', inviteCodeTitle:'あなたの招待コード', copyBtn:'コピー', friendCodePh:'友達のコードを入力', addBtn:'追加', shareLabel:'自分の再生中を友達に共有する', nowPlayingTitle:'友達が今聴いている曲', sourceSpotify:'Spotify', sourceApp:'アプリ内', playSabiBtn:'▶ サビ', notPlaying:'今は聴いていません', friendsEmpty:'コードを交換して友達を追加しましょう', copied:'コピーしました', friendAdded:'{name}さんを追加しました', nowPreviewToast:'♪ {title}', genre_all:'すべて', genre_jpop:'J-POP/アジア', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/HipHop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternative', genre_jazz:'Jazz', err_name_required:'名前を入力してください', err_code_not_found:'コードが見つかりません', err_spotify_not_configured:'Spotify連携が設定されていません', err_spotify_not_linked:'Spotifyと連携してください', err_no_tracks_selected:'曲を選んでください', err_playlist_create_failed:'Spotifyプレイリストの作成に失敗しました', err_unauth:'ログインしてください', err_not_found:'見つかりません', err_generic:'エラーが発生しました', navSettings:'設定', pinBtn:'ピン留め', unpinBtn:'ピン留めを解除', pinnedToast:'📌 ピン留めしました', unpinnedToast:'ピン留めを解除しました', settingsTitle:'設定', languageLabel:'言語', nicknameLabel:'ニックネーム', saveBtn:'保存', savedToast:'保存しました', spotifyLabel:'Spotify連携', spotifyConnected:'連携済み', spotifyNotConnected:'未連携', unlinkBtn:'連携解除', logoutBtn:'ログアウト', dangerZoneTitle:'危険な操作', deleteAccountBtn:'アカウントを削除', confirmDeleteAccount:'アカウントを削除しますか? この操作は取り消せません。'},
  en: {langName:'English', tagline:'Listen to the hook, discover songs you love.<br>See what your friends are playing right now.', spotifyStart:'Get started with Spotify', orTry:'or try it without Spotify', nickname:'Nickname', start:'Start', searchPh:'Search artist or song', discoverHint:'← Skip / → Like / Space Play-Pause / Z Undo (30s preview ≈ the hook)', navDiscover:'Discover', navLibrary:'Library', navFriends:'Friends', whoSpotify:' · Spotify connected', noTracksFound:'No tracks found', tapToPlay:'▶ Tap to play the hook', likedAdded:'♥ Added to library', likeBadge:'Like', skipBadge:'Skip', nothingToUndo:'Nothing to undo', undoToast:'↩ Undone', libCreateTitle:'Create a playlist', plNamePh:'Playlist name', plDefaultPrefix:'Swipee', plDesc:'Created with Swipee', mixLabel:'Auto-add similar tracks up to 30 songs', mkBtnSpotify:'Create on Spotify', mkBtnLocal:'Create playlist', selectAllBtn:'Select all', deleteSelectedBtn:'Delete selected', confirmDeleteSelected:'Delete {n} tracks?', notLinkedHint:'※ Not linked to Spotify — saved in the app only.', spotifyLinkText:'Link Spotify', likedTitle:'Liked songs ({n})', likedEmpty:'Tap ♥ on Discover to collect songs here', deleteBtn:'Remove', playlistsTitle:'Created playlists', trackCount:'{n} tracks', matchedSuffix:' · {n} matched on Spotify', playlistsEmpty:'None yet', openBtn:'Open', creating:'Creating…', createdSpotify:'Created on Spotify', createdLocal:'Created', inviteCodeTitle:'Your invite code', copyBtn:'Copy', friendCodePh:"Enter a friend's code", addBtn:'Add', shareLabel:"Share what I'm playing with friends", nowPlayingTitle:'What friends are playing', sourceSpotify:'Spotify', sourceApp:'In-app', playSabiBtn:'▶ Hook', notPlaying:'Not listening right now', friendsEmpty:'Exchange codes to add friends', copied:'Copied', friendAdded:'Added {name}', nowPreviewToast:'♪ {title}', genre_all:'All', genre_jpop:'J-Pop / Asia', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/Hip-Hop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternative', genre_jazz:'Jazz', err_name_required:'Please enter a name', err_code_not_found:'Code not found', err_spotify_not_configured:"Spotify isn't configured", err_spotify_not_linked:'Please link Spotify', err_no_tracks_selected:'Select some tracks first', err_playlist_create_failed:'Failed to create the Spotify playlist', err_unauth:'Please log in', err_not_found:'Not found', err_generic:'Something went wrong', navSettings:'Settings', pinBtn:'Pin', unpinBtn:'Unpin', pinnedToast:'📌 Pinned', unpinnedToast:'Unpinned', settingsTitle:'Settings', languageLabel:'Language', nicknameLabel:'Nickname', saveBtn:'Save', savedToast:'Saved', spotifyLabel:'Spotify connection', spotifyConnected:'Connected', spotifyNotConnected:'Not connected', unlinkBtn:'Unlink', logoutBtn:'Log out', dangerZoneTitle:'Danger zone', deleteAccountBtn:'Delete account', confirmDeleteAccount:'Delete your account? This cannot be undone.'},
  ko: {langName:'한국어', tagline:'후렴만 듣고 좋아하는 곡을 발견하세요.<br>친구가 지금 듣고 있는 곡도 볼 수 있어요.', spotifyStart:'Spotify로 시작하기', orTry:'또는 (Spotify 연동 없이 체험하기)', nickname:'닉네임', start:'시작하기', searchPh:'아티스트·곡명 검색', discoverHint:'← 스킵 / → 좋아요 / 스페이스 재생·정지 / Z 되돌리기 (30초 미리듣기=후렴 부근)', navDiscover:'발견', navLibrary:'보관함', navFriends:'친구', whoSpotify:' · Spotify 연동됨', noTracksFound:'곡을 찾을 수 없어요', tapToPlay:'▶ 탭해서 후렴 재생', likedAdded:'♥ 보관함에 추가됨', likeBadge:'좋아요', skipBadge:'스킵', nothingToUndo:'되돌릴 스와이프가 없어요', undoToast:'↩ 되돌렸어요', libCreateTitle:'플레이리스트 만들기', plNamePh:'플레이리스트 이름', plDefaultPrefix:'Swipee', plDesc:'Swipee로 생성', mixLabel:'비슷한 곡을 자동으로 추가해 30곡으로 채우기', mkBtnSpotify:'Spotify에 플레이리스트 만들기', mkBtnLocal:'플레이리스트 만들기', selectAllBtn:'전체 선택', deleteSelectedBtn:'선택한 곡 삭제', confirmDeleteSelected:'{n}곡을 삭제할까요?', notLinkedHint:'※ Spotify 미연동 상태라 앱 안에만 저장돼요.', spotifyLinkText:'Spotify 연동하기', likedTitle:'좋아요한 곡 ({n})', likedEmpty:'발견 탭에서 ♥를 누르면 여기에 모여요', deleteBtn:'삭제', playlistsTitle:'만든 플레이리스트', trackCount:'{n}곡', matchedSuffix:' · Spotify에서 {n}곡 일치', playlistsEmpty:'아직 없어요', openBtn:'열기', creating:'만드는 중…', createdSpotify:'Spotify에 만들었어요', createdLocal:'만들었어요', inviteCodeTitle:'내 초대 코드', copyBtn:'복사', friendCodePh:'친구 코드 입력', addBtn:'추가', shareLabel:'내가 듣는 곡을 친구에게 공유', nowPlayingTitle:'친구가 지금 듣는 곡', sourceSpotify:'Spotify', sourceApp:'앱 내', playSabiBtn:'▶ 후렴', notPlaying:'지금은 듣고 있지 않아요', friendsEmpty:'코드를 교환해서 친구를 추가해보세요', copied:'복사했어요', friendAdded:'{name}님을 추가했어요', nowPreviewToast:'♪ {title}', genre_all:'전체', genre_jpop:'J-POP/아시아', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'랩/힙합', genre_rnb:'R&B', genre_dance:'댄스', genre_electro:'일렉트로', genre_alternative:'얼터너티브', genre_jazz:'재즈', err_name_required:'이름을 입력해주세요', err_code_not_found:'코드를 찾을 수 없어요', err_spotify_not_configured:'Spotify 연동이 설정되지 않았어요', err_spotify_not_linked:'Spotify를 연동해주세요', err_no_tracks_selected:'곡을 선택해주세요', err_playlist_create_failed:'Spotify 플레이리스트 생성에 실패했어요', err_unauth:'로그인해주세요', err_not_found:'찾을 수 없어요', err_generic:'오류가 발생했어요', navSettings:'설정', pinBtn:'고정', unpinBtn:'고정 해제', pinnedToast:'📌 고정했어요', unpinnedToast:'고정을 해제했어요', settingsTitle:'설정', languageLabel:'언어', nicknameLabel:'닉네임', saveBtn:'저장', savedToast:'저장했어요', spotifyLabel:'Spotify 연동', spotifyConnected:'연동됨', spotifyNotConnected:'미연동', unlinkBtn:'연동 해제', logoutBtn:'로그아웃', dangerZoneTitle:'위험 구역', deleteAccountBtn:'계정 삭제', confirmDeleteAccount:'계정을 삭제할까요? 이 작업은 되돌릴 수 없어요.'},
  zh: {langName:'中文', tagline:'只听副歌,发现你喜欢的歌。<br>还能看到朋友现在在听什么。', spotifyStart:'使用 Spotify 开始', orTry:'或(不连接 Spotify 体验)', nickname:'昵称', start:'开始', searchPh:'搜索歌手或歌曲', discoverHint:'← 跳过 / → 喜欢 / 空格 播放·暂停 / Z 撤销(30秒预览≈副歌部分)', navDiscover:'发现', navLibrary:'音乐库', navFriends:'朋友', whoSpotify:' · 已连接 Spotify', noTracksFound:'没有找到歌曲', tapToPlay:'▶ 点击播放副歌', likedAdded:'♥ 已加入音乐库', likeBadge:'喜欢', skipBadge:'跳过', nothingToUndo:'没有可撤销的操作', undoToast:'↩ 已撤销', libCreateTitle:'创建歌单', plNamePh:'歌单名称', plDefaultPrefix:'Swipee', plDesc:'由 Swipee 创建', mixLabel:'自动加入相似歌曲,凑满30首', mkBtnSpotify:'在 Spotify 创建歌单', mkBtnLocal:'创建歌单', selectAllBtn:'全选', deleteSelectedBtn:'删除所选', confirmDeleteSelected:'删除{n}首歌曲?', notLinkedHint:'※ 未连接 Spotify,将仅保存在应用内。', spotifyLinkText:'连接 Spotify', likedTitle:'喜欢的歌曲 ({n})', likedEmpty:'在发现页点♥收藏歌曲吧', deleteBtn:'删除', playlistsTitle:'已创建的歌单', trackCount:'{n}首', matchedSuffix:' · 在 Spotify 匹配到{n}首', playlistsEmpty:'暂无', openBtn:'打开', creating:'创建中…', createdSpotify:'已在 Spotify 创建', createdLocal:'已创建', inviteCodeTitle:'你的邀请码', copyBtn:'复制', friendCodePh:'输入朋友的邀请码', addBtn:'添加', shareLabel:'把我正在听的歌分享给朋友', nowPlayingTitle:'朋友正在听的歌', sourceSpotify:'Spotify', sourceApp:'应用内', playSabiBtn:'▶ 副歌', notPlaying:'现在没有在听', friendsEmpty:'交换邀请码来添加朋友吧', copied:'已复制', friendAdded:'已添加 {name}', nowPreviewToast:'♪ {title}', genre_all:'全部', genre_jpop:'J-POP/亚洲', genre_pop:'流行', genre_rock:'摇滚', genre_rap:'说唱/嘻哈', genre_rnb:'R&B', genre_dance:'舞曲', genre_electro:'电子', genre_alternative:'另类', genre_jazz:'爵士', err_name_required:'请输入名字', err_code_not_found:'未找到该邀请码', err_spotify_not_configured:'尚未配置 Spotify 连接', err_spotify_not_linked:'请先连接 Spotify', err_no_tracks_selected:'请先选择歌曲', err_playlist_create_failed:'创建 Spotify 歌单失败', err_unauth:'请先登录', err_not_found:'未找到', err_generic:'出错了', navSettings:'设置', pinBtn:'置顶', unpinBtn:'取消置顶', pinnedToast:'📌 已置顶', unpinnedToast:'已取消置顶', settingsTitle:'设置', languageLabel:'语言', nicknameLabel:'昵称', saveBtn:'保存', savedToast:'已保存', spotifyLabel:'Spotify 连接', spotifyConnected:'已连接', spotifyNotConnected:'未连接', unlinkBtn:'取消连接', logoutBtn:'退出登录', dangerZoneTitle:'危险操作', deleteAccountBtn:'删除账户', confirmDeleteAccount:'删除账户?此操作无法撤销。'},
  es: {langName:'Español', tagline:'Escucha el estribillo y descubre canciones que te encantarán.<br>Mira qué está escuchando tu amigos ahora mismo.', spotifyStart:'Empezar con Spotify', orTry:'o pruébalo sin conectar Spotify', nickname:'Apodo', start:'Empezar', searchPh:'Buscar artista o canción', discoverHint:'← Saltar / → Me gusta / Espacio Reproducir-Pausar / Z Deshacer (avance de 30s ≈ el estribillo)', navDiscover:'Descubrir', navLibrary:'Biblioteca', navFriends:'Amigos', whoSpotify:' · Spotify conectado', noTracksFound:'No se encontraron canciones', tapToPlay:'▶ Toca para escuchar el estribillo', likedAdded:'♥ Añadido a la biblioteca', likeBadge:'Me gusta', skipBadge:'Saltar', nothingToUndo:'No hay nada que deshacer', undoToast:'↩ Deshecho', libCreateTitle:'Crear una playlist', plNamePh:'Nombre de la playlist', plDefaultPrefix:'Swipee', plDesc:'Creado con Swipee', mixLabel:'Añadir canciones similares automáticamente hasta 30', mkBtnSpotify:'Crear en Spotify', mkBtnLocal:'Crear playlist', selectAllBtn:'Seleccionar todo', deleteSelectedBtn:'Eliminar seleccionadas', confirmDeleteSelected:'¿Eliminar {n} canciones?', notLinkedHint:'※ Como no está conectado Spotify, se guarda solo en la app.', spotifyLinkText:'Conectar Spotify', likedTitle:'Canciones con me gusta ({n})', likedEmpty:'Toca ♥ en Descubrir para guardar canciones aquí', deleteBtn:'Quitar', playlistsTitle:'Playlists creadas', trackCount:'{n} canciones', matchedSuffix:' · {n} encontradas en Spotify', playlistsEmpty:'Todavía no hay ninguna', openBtn:'Abrir', creating:'Creando…', createdSpotify:'Creada en Spotify', createdLocal:'Creada', inviteCodeTitle:'Tu código de invitación', copyBtn:'Copiar', friendCodePh:'Escribe el código de un amigo', addBtn:'Añadir', shareLabel:'Compartir lo que escucho con mis amigos', nowPlayingTitle:'Lo que están escuchando tus amigos', sourceSpotify:'Spotify', sourceApp:'En la app', playSabiBtn:'▶ Estribillo', notPlaying:'Ahora mismo no está escuchando nada', friendsEmpty:'Intercambia códigos para añadir amigos', copied:'Copiado', friendAdded:'Se añadió a {name}', nowPreviewToast:'♪ {title}', genre_all:'Todo', genre_jpop:'J-Pop / Asia', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/Hip-Hop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternativa', genre_jazz:'Jazz', err_name_required:'Por favor, introduce un nombre', err_code_not_found:'Código no encontrado', err_spotify_not_configured:'Spotify no está configurado', err_spotify_not_linked:'Conecta Spotify, por favor', err_no_tracks_selected:'Selecciona alguna canción primero', err_playlist_create_failed:'No se pudo crear la playlist en Spotify', err_unauth:'Inicia sesión, por favor', err_not_found:'No encontrado', err_generic:'Ocurrió un error', navSettings:'Ajustes', pinBtn:'Fijar', unpinBtn:'Dejar de fijar', pinnedToast:'📌 Fijado', unpinnedToast:'Ya no está fijado', settingsTitle:'Ajustes', languageLabel:'Idioma', nicknameLabel:'Apodo', saveBtn:'Guardar', savedToast:'Guardado', spotifyLabel:'Conexión con Spotify', spotifyConnected:'Conectado', spotifyNotConnected:'No conectado', unlinkBtn:'Desconectar', logoutBtn:'Cerrar sesión', dangerZoneTitle:'Zona de riesgo', deleteAccountBtn:'Eliminar cuenta', confirmDeleteAccount:'¿Eliminar tu cuenta? Esta acción no se puede deshacer.'},
};
const SUPPORTED = Object.keys(LANGS);
const LOCALE_TAG = {ja:'ja-JP', en:'en-US', ko:'ko-KR', zh:'zh-CN', es:'es-ES'};
function detectLang() {
  try { const saved = localStorage.getItem('lang'); if (saved && LANGS[saved]) return saved } catch {}
  const nav = (navigator.language || 'ja').toLowerCase();
  if (LANGS[nav]) return nav;
  const short = nav.split('-')[0];
  if (LANGS[short]) return short;
  return 'ja';
}
let lang = detectLang();
const tr = (key, vars) => { let s = (LANGS[lang] && LANGS[lang][key]) ?? LANGS.ja[key] ?? key; if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]); return s };
const trerr = code => { const k = 'err_' + code; return (LANGS[lang] && LANGS[lang][k]) || LANGS.ja[k] || tr('err_generic') };
function populateGenreSelect() {
  if (!genresCfg) return;
  const sel = $('#genre'), prev = sel.value;
  sel.innerHTML = Object.entries(genresCfg).map(([k, v]) => `<option value=${k}>${tr('genre_' + v)}</option>`).join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}
function applyStaticI18n() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  document.querySelectorAll('[data-i18n]').forEach(el => el.innerHTML = tr(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = tr(el.dataset.i18nPh));
  populateGenreSelect();
}
function initLangSelector() {
  const sel = $('#langSel');
  sel.innerHTML = SUPPORTED.map(c => `<option value="${c}">${LANGS[c].langName}</option>`).join('');
  sel.value = lang;
  sel.onchange = () => setLang(sel.value);
}
function setLang(l) {
  lang = LANGS[l] ? l : 'ja';
  try { localStorage.setItem('lang', lang) } catch {}
  applyStaticI18n();
  if (me) $('#who').textContent = me.name + (me.spotify ? tr('whoSpotify') : '');
  const tap = $('#tap'); if (tap) tap.textContent = tr('tapToPlay');
  const lb = $('#badgeLike'), sb = $('#badgeSkip'); if (lb) lb.textContent = tr('likeBadge'); if (sb) sb.textContent = tr('skipBadge');
  if (!cur && $('#card')) { const p = $('#card > p.mut'); if (p) p.textContent = tr('noTracksFound') }
  const activeTab = document.querySelector('nav .on')?.dataset.tab;
  if (me && activeTab === 'library') renderLibrary();
  if (me && activeTab === 'friends') renderFriends();
  if (me && activeTab === 'settings') renderSettings();
}

function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden') }
async function init() {
  initLangSelector(); applyStaticI18n();
  const cfg = await fetch('/api/config').then(r => r.json());
  genresCfg = cfg.genres; populateGenreSelect();
  if (!cfg.spotify_configured) $('#spLogin').style.display = 'none';
  try { me = await api('/api/me') } catch { return showLogin() }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#who').textContent = me.name + (me.spotify ? tr('whoSpotify') : '');
  loadFeed();
}
$('#demoForm').onsubmit = async e => { e.preventDefault(); try { await api('/api/login', {name: $('#name').value}); init() } catch (e) { toast(trerr(e.message)) } };

// ---- 発見 ----
async function loadFeed() { queue = await api(`/api/feed?genre=${$('#genre').value}&q=${encodeURIComponent($('#q').value)}`); next(false) }
$('#genre').onchange = () => { $('#q').value = ''; loadFeed() }; $('#q').onchange = loadFeed;
function next(autoplay = true) {
  swiping = false;
  const card = $('#card');
  card.style.transition = 'none'; card.style.transform = ''; card.style.opacity = ''; // 飛んでいった前のカードの見た目を新しいカードへ引き継がせない
  if (!queue.length) { card.innerHTML = `<p class=mut style="margin-top:160px">${tr('noTracksFound')}</p>`; void card.offsetHeight; card.style.transition = ''; audio.pause(); cur = null; return loadMore() }
  cur = queue.shift(); reported = false;
  card.innerHTML = `<div class="badge like" id="badgeLike">${tr('likeBadge')}</div><div class="badge skip" id="badgeSkip">${tr('skipBadge')}</div><img src="${esc(cur.cover)}"><h2>${esc(cur.title)}</h2><div class=ar>${esc(cur.artist)}</div><div class=bar><i id=prog></i></div>${autoplay ? '' : `<div class=tap id=tap>${tr('tapToPlay')}</div>`}`;
  void card.offsetHeight; card.style.transition = ''; // reflowを挟んでから transition を戻し、リセット自体はアニメーションさせない
  const tap = $('#tap'); if (tap) tap.onclick = () => { tap.remove(); play() };
  audio.src = cur.preview; if (autoplay) play();
  if (queue.length < 5) loadMore();
}
let loading = false; async function loadMore() { if (loading) return; loading = true; try { const more = await api(`/api/feed?genre=${$('#genre').value}&q=${encodeURIComponent($('#q').value)}`); const ids = new Set(queue.map(t => t.id)); queue.push(...more.filter(t => !ids.has(t.id) && t.id !== cur?.id)); if (!cur) next() } finally { loading = false } }
const play = () => audio.play().catch(() => {});
audio.ontimeupdate = () => { const p = $('#prog'); if (p && audio.duration) p.style.width = audio.currentTime / audio.duration * 100 + '%';
  if (!reported && audio.currentTime > 5 && cur) { reported = true; api('/api/nowplaying', {track: cur}).catch(() => {}) } };
audio.onended = () => play();
audio.addEventListener('play', () => { $('#pause').textContent = '⏸' });
audio.addEventListener('pause', () => { $('#pause').textContent = '▶' });
$('#pause').onclick = () => { audio.paused ? play() : audio.pause() };
async function like() { if (!cur) return; await api('/api/like', {track: cur}); me.likes.push(cur); toast(tr('likedAdded')); next() }

// ---- スワイプ(指に追従して傾き、フリックでカードが飛んでいく) ----
let swiping = false, history = [];
function commitSwipe(dir) {
  if (!cur || swiping) return;
  swiping = true;
  history.push(cur); if (history.length > 30) history.shift();
  const card = $('#card');
  card.style.transition = 'transform .3s ease, opacity .3s ease';
  card.style.transform = `translate(${dir * (innerWidth * 0.9 + 120)}px, -30px) rotate(${dir * 24}deg)`;
  card.style.opacity = '0';
  setTimeout(() => { dir > 0 ? like() : next() }, 260);
}
// ---- やり直し(直前にスワイプした曲をもう一度カードに戻す) ----
async function undoSwipe() {
  if (swiping) return;
  const last = history.pop();
  if (!last) return toast(tr('nothingToUndo'));
  if (me.likes.some(t => t.id === last.id)) { // いいね済みなら取り消す
    try { await api('/api/unlike', {id: last.id}); me.likes = me.likes.filter(t => t.id !== last.id) } catch {}
  }
  if (cur) queue.unshift(cur);
  queue.unshift(last);
  cur = null;
  next(false);
  toast(tr('undoToast'));
}
$('#undo').onclick = undoSwipe;
let drag = null;
function dragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = e.clientX - drag.sx; drag.dy = e.clientY - drag.sy;
  $('#card').style.transform = `translate(${drag.dx}px, ${drag.dy * 0.15}px) rotate(${drag.dx / 18}deg)`;
  const t = Math.min(Math.abs(drag.dx) / 110, 1), lb = $('#badgeLike'), sb = $('#badgeSkip');
  if (lb) lb.style.opacity = drag.dx > 12 ? t : 0;
  if (sb) sb.style.opacity = drag.dx < -12 ? t : 0;
}
function dragEnd(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const card = $('#card');
  card.removeEventListener('pointermove', dragMove); card.removeEventListener('pointerup', dragEnd); card.removeEventListener('pointercancel', dragEnd);
  card.classList.remove('dragging');
  const dx = drag.dx; drag = null;
  if (dx > 100) commitSwipe(1);
  else if (dx < -100) commitSwipe(-1);
  else { card.style.transition = 'transform .25s, opacity .25s'; card.style.transform = ''; const lb = $('#badgeLike'), sb = $('#badgeSkip'); if (lb) lb.style.opacity = 0; if (sb) sb.style.opacity = 0 }
}
$('#card').addEventListener('pointerdown', e => {
  if (!cur || swiping || e.button > 0) return;
  const card = $('#card');
  drag = {id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0};
  try { card.setPointerCapture(e.pointerId) } catch {}
  card.classList.add('dragging');
  card.addEventListener('pointermove', dragMove); card.addEventListener('pointerup', dragEnd); card.addEventListener('pointercancel', dragEnd);
});
$('#like').onclick = () => commitSwipe(1); $('#skip').onclick = () => commitSwipe(-1); $('#replay').onclick = () => { audio.currentTime = 0; play() };
document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') commitSwipe(1); if (e.key === 'ArrowLeft') commitSwipe(-1); if (e.key === ' ') { e.preventDefault(); audio.paused ? play() : audio.pause() } if (e.key === 'z' || e.key === 'Z') undoSwipe(); });

// ---- タブ ----
document.querySelectorAll('nav button').forEach(b => b.onclick = async () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + b.dataset.tab));
  if (b.dataset.tab !== 'discover') audio.pause();
  if (b.dataset.tab === 'library') { me = await api('/api/me'); renderLibrary() }
  if (b.dataset.tab === 'friends') renderFriends()
  if (b.dataset.tab === 'settings') { me = await api('/api/me'); renderSettings() }
});
const row = (t, extra = '') => `<div class=row><img src="${esc(t.cover)}"><div class=t><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>${extra}</div>`;

// ---- 左右スワイプ(Spotify風: 左=削除、右=ピン留め。最後まで振り切ると即実行、途中で離すとボタンだけ出す) ----
const REVEAL = 76, FULL = 190;
let openSwipeRow = null, openSwipeDir = 0;
function closeOpenSwipe() { if (openSwipeRow) { openSwipeRow.style.transition = 'transform .2s ease'; openSwipeRow.style.transform = 'translateX(0)'; openSwipeRow = null; openSwipeDir = 0 } }
document.addEventListener('pointerdown', e => { if (openSwipeRow && !e.target.closest('.swiperow')) closeOpenSwipe() });
function wireSwipe(wrap, {onDelete, onPin} = {}) {
  const row = wrap.querySelector('.row'), del = wrap.querySelector('.swipe-del'), pin = wrap.querySelector('.swipe-pin');
  let id = null, sx = 0, base = 0, committed = false;
  row.addEventListener('pointerdown', e => {
    if (e.button > 0 || committed) return;
    if (openSwipeRow && openSwipeRow !== row) closeOpenSwipe();
    id = e.pointerId; sx = e.clientX; base = row === openSwipeRow ? openSwipeDir * REVEAL : 0; committed = false;
    row.style.transition = 'none'; try { row.setPointerCapture(id) } catch {}
    row.addEventListener('pointermove', move); row.addEventListener('pointerup', up); row.addEventListener('pointercancel', up);
  });
  function move(e) {
    if (e.pointerId !== id || committed) return;
    const d = Math.max(-FULL, Math.min(FULL, base + (e.clientX - sx)));
    row.style.transform = `translateX(${d}px)`;
  }
  function commit(fn) {
    committed = true; openSwipeRow = null; openSwipeDir = 0;
    row.style.transition = 'transform .18s ease, opacity .18s ease';
    row.style.opacity = '0';
    setTimeout(fn, 150);
  }
  function up(e) {
    if (e.pointerId !== id) return;
    row.removeEventListener('pointermove', move); row.removeEventListener('pointerup', up); row.removeEventListener('pointercancel', up);
    if (committed) return;
    const moved = Math.abs(e.clientX - sx), wasOpen = Math.abs(base) === REVEAL;
    const m = /translateX\((-?[\d.]+)/.exec(row.style.transform); const cur = m ? parseFloat(m[1]) : 0;
    row.style.transition = 'transform .2s ease';
    if (wasOpen && moved < 6) { row.style.transform = 'translateX(0)'; openSwipeRow = null; openSwipeDir = 0; return } // 開いた状態でタップしただけなら閉じる
    if (cur <= -FULL + 4 && onDelete) return commit(onDelete); // 左いっぱいまで振り切ったら即削除
    if (cur >= FULL - 4 && onPin) return commit(onPin); // 右いっぱいまで振り切ったら即ピン留め切替
    if (cur < -REVEAL / 2 && del) { row.style.transform = `translateX(-${REVEAL}px)`; openSwipeRow = row; openSwipeDir = -1 }
    else if (cur > REVEAL / 2 && pin) { row.style.transform = `translateX(${REVEAL}px)`; openSwipeRow = row; openSwipeDir = 1 }
    else { row.style.transform = 'translateX(0)'; if (openSwipeRow === row) { openSwipeRow = null; openSwipeDir = 0 } }
  }
  if (del) del.onclick = () => { closeOpenSwipe(); onDelete() };
  if (pin) pin.onclick = () => { closeOpenSwipe(); onPin() };
}
const swipeRow = (inner, id, pinned) => `<div class="swiperow" data-id="${id}"><button class="swipe-action swipe-pin${pinned ? ' active' : ''}" title="${esc(pinned ? tr('unpinBtn') : tr('pinBtn'))}">📌</button>${inner}<button class="swipe-action swipe-del" title="${esc(tr('deleteBtn'))}">🗑</button></div>`;

function renderLibrary() {
  openSwipeRow = null;
  const el = $('#tab-library');
  const likesSorted = me.likes.slice().reverse().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const plsSorted = me.playlists.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  el.innerHTML = `<h3>${tr('libCreateTitle')}</h3>
    <div class=bx><input id=plName placeholder="${tr('plNamePh')}" value="${esc(tr('plDefaultPrefix'))} ${new Date().toLocaleDateString(LOCALE_TAG[lang])}"></div>
    <label class=mut><input type=checkbox id=mix checked> ${tr('mixLabel')}</label>
    <div class=bx><button class="btn green" id=mk>${me.spotify ? tr('mkBtnSpotify') : tr('mkBtnLocal')}</button><button class="btn sm" id=all>${tr('selectAllBtn')}</button>${me.likes.length ? `<button class="btn sm danger" id=delSel>${tr('deleteSelectedBtn')}</button>` : ''}</div>
    ${me.spotify ? '' : `<p class=hint style="text-align:left">${tr('notLinkedHint')} <a href="/auth/login">${tr('spotifyLinkText')}</a></p>`}
    <h3>${tr('likedTitle', {n: me.likes.length})}</h3>
    ${likesSorted.length ? likesSorted.map(t => swipeRow(row({...t, title: (t.pinned ? '📌 ' : '') + t.title}, `<input type=checkbox data-id=${t.id} ${selected.has(t.id) ? 'checked' : ''}>`), t.id, t.pinned)).join('') : `<p class=mut>${tr('likedEmpty')}</p>`}
    <h3>${tr('playlistsTitle')}</h3>${plsSorted.map(p => swipeRow(`<div class=row><div class=t><b>${p.pinned ? '📌 ' : ''}${esc(p.name)}</b><small>${tr('trackCount', {n: p.tracks.length})}${p.spotify_url ? tr('matchedSuffix', {n: p.matched}) : ''}</small>${p.error ? `<small style="color:#f66">${esc(trerr(p.error))}</small>` : ''}</div>${p.spotify_url ? `<a class="btn sm" target=_blank href="${esc(p.spotify_url)}">${tr('openBtn')}</a>` : ''}</div>`, p.id, p.pinned)).join('') || `<p class=mut>${tr('playlistsEmpty')}</p>`}`;
  el.querySelectorAll('[data-id]').forEach(c => { if (c.matches('input[type=checkbox]')) c.onchange = () => c.checked ? selected.add(+c.dataset.id) : selected.delete(+c.dataset.id) });
  el.querySelectorAll('.swiperow').forEach(w => {
    const isTrack = me.likes.some(t => String(t.id) === w.dataset.id);
    const kind = isTrack ? 'track' : 'playlist';
    const cur = isTrack ? me.likes.find(t => String(t.id) === w.dataset.id) : me.playlists.find(p => p.id === w.dataset.id);
    wireSwipe(w, {
      onDelete: async () => {
        if (isTrack) { await api('/api/unlike', {id: +w.dataset.id}); selected.delete(+w.dataset.id) } else { await api('/api/playlist/delete', {id: w.dataset.id}) }
        me = await api('/api/me'); renderLibrary();
      },
      onPin: async () => {
        const nowPinned = !(cur && cur.pinned);
        await api('/api/pin', {kind, id: w.dataset.id, pinned: nowPinned});
        toast(nowPinned ? tr('pinnedToast') : tr('unpinnedToast'));
        me = await api('/api/me'); renderLibrary();
      },
    });
  });
  $('#all').onclick = () => { me.likes.forEach(t => selected.add(t.id)); renderLibrary() };
  const delSel = $('#delSel');
  if (delSel) delSel.onclick = async () => {
    const ids = [...selected]; if (!ids.length) return toast(trerr('no_tracks_selected'));
    if (!confirm(tr('confirmDeleteSelected', {n: ids.length}))) return;
    delSel.disabled = true;
    for (const id of ids) { try { await api('/api/unlike', {id}) } catch {} }
    selected.clear(); me = await api('/api/me'); renderLibrary();
  };
  $('#mk').onclick = async () => {
    const tr2 = me.likes.filter(t => selected.has(t.id)); if (!tr2.length) return toast(trerr('no_tracks_selected'));
    $('#mk').disabled = true; $('#mk').textContent = tr('creating');
    try { const p = await api('/api/playlist', {name: $('#plName').value, tracks: tr2, mix: $('#mix').checked, size: 30, desc: tr('plDesc')}); toast(p.spotify_url ? tr('createdSpotify') : tr('createdLocal')); selected.clear() } catch (e) { toast(trerr(e.message)) }
    me = await api('/api/me'); renderLibrary();
  };
}

let friendTimer;
async function renderFriends() {
  clearInterval(friendTimer);
  const draw = async () => {
    if ($('#tab-friends').classList.contains('hidden')) return clearInterval(friendTimer);
    const fs = await api('/api/friends'), el = $('#tab-friends'), keep = $('#code')?.value || '';
    el.innerHTML = `<h3>${tr('inviteCodeTitle')}</h3><div class=row><b style="font-size:1.5rem;letter-spacing:.15em;flex:1">${me.code}</b><button class="btn sm" id=copy>${tr('copyBtn')}</button></div>
      <div class=bx><input id=code placeholder="${tr('friendCodePh')}" value="${esc(keep)}"><button class="btn" id=add>${tr('addBtn')}</button></div>
      <h3>${tr('nowPlayingTitle')}</h3>
      ${fs.map(f => f.now ? row(f.now.track, `<div style="text-align:right"><div class=live>● ${f.now.source === 'spotify' ? tr('sourceSpotify') : tr('sourceApp')}</div><small>${esc(f.name)}</small>${f.now.track.id ? `<br><button class="btn sm" data-pv=${f.now.track.id}>${tr('playSabiBtn')}</button> <button class="btn sm" data-lk=${f.now.track.id}>♥</button>` : ''}</div>`)
        : `<div class=row><div class=t><b>${esc(f.name)}</b><small>${tr('notPlaying')}</small></div></div>`).join('') || `<p class=mut>${tr('friendsEmpty')}</p>`}`;
    $('#copy').onclick = () => { navigator.clipboard?.writeText(me.code); toast(tr('copied')) };
    $('#add').onclick = async () => { try { const r = await api('/api/friends/add', {code: $('#code').value}); toast(tr('friendAdded', {name: r.name})); draw() } catch (e) { toast(trerr(e.message)) } };
    el.querySelectorAll('[data-pv]').forEach(b => b.onclick = async () => { const t = await api('/api/preview?id=' + b.dataset.pv); audio.src = t.preview; play(); toast(tr('nowPreviewToast', {title: t.title})) });
    el.querySelectorAll('[data-lk]').forEach(b => b.onclick = async () => { const t = await api('/api/preview?id=' + b.dataset.lk); await api('/api/like', {track: t}); toast(tr('likedAdded')) });
  };
  await draw(); friendTimer = setInterval(() => { if (document.activeElement?.id !== 'code') draw() }, 10000);
}

function renderSettings() {
  const el = $('#tab-settings');
  el.innerHTML = `<h3>${tr('settingsTitle')}</h3>
    <div class=bx><label class=mut style="flex:1">${tr('languageLabel')}<br><select id=setLang style="margin-top:6px;width:100%"></select></label></div>
    <div class=bx><input id=setName maxlength=20 value="${esc(me.name)}" placeholder="${tr('nicknameLabel')}"><button class="btn" id=setNameSave>${tr('saveBtn')}</button></div>
    <label class=mut><input type=checkbox id=setShare ${me.share ? 'checked' : ''}> ${tr('shareLabel')}</label>
    <h3>${tr('spotifyLabel')}</h3>
    <div class=row><div class=t><b>${me.spotify ? tr('spotifyConnected') : tr('spotifyNotConnected')}</b></div>${me.spotify ? `<button class="btn sm danger" id=spUnlink>${tr('unlinkBtn')}</button>` : `<a class="btn sm green" href="/auth/login">${tr('spotifyLinkText')}</a>`}</div>
    <div class=bx><button class="btn" id=logout>${tr('logoutBtn')}</button></div>
    <h3 style="color:#ff9db3">${tr('dangerZoneTitle')}</h3>
    <div class=bx><button class="btn danger" id=delAcct>${tr('deleteAccountBtn')}</button></div>`;
  const setLangSel = $('#setLang');
  setLangSel.innerHTML = SUPPORTED.map(c => `<option value="${c}">${LANGS[c].langName}</option>`).join('');
  setLangSel.value = lang;
  setLangSel.onchange = () => { setLang(setLangSel.value); $('#langSel').value = lang; renderSettings() };
  $('#setNameSave').onclick = async () => {
    const v = $('#setName').value.trim(); if (!v) return toast(trerr('name_required'));
    try { await api('/api/profile', {name: v}); me = await api('/api/me'); $('#who').textContent = me.name + (me.spotify ? tr('whoSpotify') : ''); toast(tr('savedToast')) } catch (e) { toast(trerr(e.message)) }
  };
  $('#setShare').onchange = e => api('/api/share', {share: e.target.checked}).then(() => me.share = e.target.checked);
  const spUnlink = $('#spUnlink');
  if (spUnlink) spUnlink.onclick = async () => { await api('/api/spotify/unlink'); me = await api('/api/me'); $('#who').textContent = me.name; renderSettings() };
  $('#logout').onclick = async () => { await api('/api/logout'); location.reload() };
  $('#delAcct').onclick = async () => {
    if (!confirm(tr('confirmDeleteAccount'))) return;
    await api('/api/account/delete');
    location.reload();
  };
}
init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
function setMedia() { if (!('mediaSession' in navigator) || !cur) return;
  navigator.mediaSession.metadata = new MediaMetadata({title: cur.title, artist: cur.artist, artwork: [{src: cur.cover, sizes: '250x250'}]});
  navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', () => { audio.currentTime = 0; play() });
  navigator.mediaSession.setActionHandler('play', play); navigator.mediaSession.setActionHandler('pause', () => audio.pause()) }
audio.addEventListener('play', setMedia);
