const $ = s => document.querySelector(s), audio = $('#audio');
const api = async (p, body) => { const r = await fetch(p, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {}); if (r.status === 401) { showLogin(); throw 0 } const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error'); return j };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600) };
let me, queue = [], cur = null, reported = false, selected = new Set(), genresCfg = null;

// ---- テーマ(ライト/ダーク/端末に合わせる) ----
const getTheme = () => { try { return localStorage.getItem('theme') || 'system' } catch { return 'system' } };
function setTheme(t) {
  try { localStorage.setItem('theme', t) } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
setTheme(getTheme());

// ---- 再生・操作の個人設定(端末ローカル。バックグラウンド再生/自動再生/振動/モーション削減) ----
const getPref = (key, def) => { try { const v = localStorage.getItem('pref_' + key); return v === null ? def : v === '1' } catch { return def } };
function setPref(key, val) { try { localStorage.setItem('pref_' + key, val ? '1' : '0') } catch {} }
function applyReduceMotion() { document.documentElement.toggleAttribute('data-reduce-motion', getPref('reduceMotion', false)); }
applyReduceMotion();
document.addEventListener('visibilitychange', () => { if (document.hidden && !getPref('bgPlayback', true) && !audio.paused) audio.pause(); });
function haptic(ms) { if (getPref('haptics', true) && navigator.vibrate) { try { navigator.vibrate(ms) } catch {} } }

// ---- 多言語(i18n) ----
const LANGS = {
  ja: {langName:'日本語', tagline:'サビだけ聴いて、好きな曲に出会う。<br>友達が今聴いている曲も見れる。', spotifyStart:'Spotifyで始める', spotifyBetaNote:'※Spotify連携は現在テスター限定で提供中です(審査が通れば今後拡大予定)', orTry:'または(Spotify連携なしで試す)', nickname:'ニックネーム', start:'はじめる', searchPh:'アーティスト・曲名で探す', discoverHint:'← スキップ / → いいね / スペース 再生・停止 / Z やり直し (30秒プレビュー=サビ付近)', navDiscover:'発見', navLibrary:'ライブラリ', navFriends:'友達', noTracksFound:'曲が見つかりません', tapToPlay:'▶ タップでサビ再生', likedAdded:'♥ ライブラリに追加', likeBadge:'いいね', skipBadge:'スキップ', nothingToUndo:'戻せる操作がありません', undoToast:'↩ 元に戻しました', libCreateTitle:'プレイリストを作る', plNamePh:'プレイリスト名', plDefaultPrefix:'Swipee', plDesc:'Swipeeで作成', mixLabel:'似た曲も自動で追加して30曲にする', mkBtnSpotify:'Spotifyにプレイリスト作成', mkBtnLocal:'プレイリスト作成', selectAllBtn:'全選択', deleteSelectedBtn:'選択した曲を削除', confirmDeleteSelected:'{n}曲を削除しますか?', notLinkedHint:'※Spotify未連携のためアプリ内に保存されます。', spotifyLinkText:'Spotifyと連携', likedTitle:'いいねした曲 ({n})', likedEmpty:'発見タブで♥を付けるとここに溜まります', deleteBtn:'削除', playlistsTitle:'作成したプレイリスト', trackCount:'{n}曲', matchedSuffix:' · Spotifyに{n}曲一致', playlistsEmpty:'まだありません', openBtn:'開く', creating:'作成中…', createdSpotify:'Spotifyに作成しました', createdLocal:'作成しました', inviteCodeTitle:'あなたの招待コード', copyBtn:'コピー', friendCodePh:'友達のコードを入力', addBtn:'追加', shareLabel:'自分の再生中を友達に共有する', nowPlayingTitle:'友達が今聴いている曲', sourceSpotify:'Spotify', sourceApp:'アプリ内', playSabiBtn:'▶ サビ', notPlaying:'今は聴いていません', friendsEmpty:'コードを交換して友達を追加しましょう', copied:'コピーしました', friendAdded:'{name}さんを追加しました', nowPreviewToast:'♪ {title}', genre_all:'すべて', genre_jpop:'J-POP', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/HipHop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternative', genre_jazz:'Jazz', genre_chill:'Chill(まったり)', genre_viral:'バイラル(SNSで話題)', err_name_required:'名前を入力してください', err_code_not_found:'コードが見つかりません', err_spotify_not_configured:'Spotify連携が設定されていません', err_spotify_not_linked:'Spotifyと連携してください', err_no_tracks_selected:'曲を選んでください', err_playlist_create_failed:'Spotifyプレイリストの作成に失敗しました', err_unauth:'ログインしてください', err_not_found:'見つかりません', err_generic:'エラーが発生しました', navSettings:'設定', pinBtn:'ピン留め', unpinBtn:'ピン留めを解除', pinnedToast:'ピン留めしました', unpinnedToast:'ピン留めを解除しました', settingsTitle:'設定', languageLabel:'言語', nicknameLabel:'ニックネーム', saveBtn:'保存', savedToast:'保存しました', spotifyLabel:'Spotify連携', spotifyConnected:'連携済み', spotifyNotConnected:'未連携', unlinkBtn:'連携解除', logoutBtn:'ログアウト', deleteAccountBtn:'アカウントを削除', confirmDeleteAccount:'アカウントを削除しますか? この操作は取り消せません。', themeLabel:'テーマ', themeSystem:'端末に合わせる', themeLight:'ライト', themeDark:'ダーク', supportTitle:'サポート', privacyTitle:'プライバシーポリシー', termsTitle:'利用規約', faqTitle:'よくある質問', contactTitle:'お問い合わせ', contactBody:'不具合の報告やご要望は、お気軽にこちらまでご連絡ください。', backBtn:'← 戻る', a2hsTitle:'ホーム画面に追加しよう', a2hsBody:'アプリのように全画面で、サクッと開けるようになります。', a2hsIOS:'Safariで開いている状態で、下の<b>共有ボタン</b>(□と↑)をタップ →「<b>ホーム画面に追加</b>」を選択', a2hsAndroid:'右上の<b>⋮メニュー</b>をタップ →「<b>アプリをインストール</b>」または「<b>ホーム画面に追加</b>」を選択', a2hsOther:'お使いのブラウザのメニューから「<b>アプリをインストール</b>」または「<b>ホーム画面に追加</b>」を選んでください', a2hsGotIt:'わかった', a2hsSettingsBtn:'ホーム画面に追加する方法', playbackSettingsTitle:'再生・操作設定', bgPlaybackLabel:'バックグラウンド再生を許可する', autoplayCardsLabel:'新しいカードを自動再生する', hapticsLabel:'スワイプ時に振動フィードバック', reduceMotionLabel:'アニメーションを減らす', publicLabel:'友達に公開する', friendPlaylistsTitle:'友達のプレイリスト', madePublicToast:'友達に公開しました', madePrivateToast:'非公開にしました', artistLabel:'アーティスト', deselectAllBtn:'全解除', genre_kpop:'K-POP', feedbackBtn:'フィードバック・ご要望を送る', feedbackTitle:'フィードバック', feedbackIntro:'Swipeeをもっと良くするために、ご意見・ご要望・不具合をお聞かせください。', fbCatIdea:'要望・アイデア', fbCatBug:'不具合の報告', fbCatOther:'その他', fbMsgPh:'ご意見・ご要望の内容を入力してください', fbContactPh:'返信が必要な場合のメールアドレス(任意)', fbSend:'送信', fbSent:'ありがとうございます!送信しました', fbNote:'送信内容(ニックネーム・端末情報を含む)は、サービス改善の目的にのみ使用します。', err_message_required:'内容を入力してください', err_rate_limited:'送信が多すぎます。しばらくしてからお試しください'},
  en: {langName:'English', tagline:'Listen to the hook, discover songs you love.<br>See what your friends are playing right now.', spotifyStart:'Get started with Spotify', spotifyBetaNote:'※ Spotify is in limited beta (testers only for now, wider access pending review)', orTry:'or try it without Spotify', nickname:'Nickname', start:'Start', searchPh:'Search artist or song', discoverHint:'← Skip / → Like / Space Play-Pause / Z Undo (30s preview ≈ the hook)', navDiscover:'Discover', navLibrary:'Library', navFriends:'Friends', noTracksFound:'No tracks found', tapToPlay:'▶ Tap to play the hook', likedAdded:'♥ Added to library', likeBadge:'Like', skipBadge:'Skip', nothingToUndo:'Nothing to undo', undoToast:'↩ Undone', libCreateTitle:'Create a playlist', plNamePh:'Playlist name', plDefaultPrefix:'Swipee', plDesc:'Created with Swipee', mixLabel:'Auto-add similar tracks up to 30 songs', mkBtnSpotify:'Create on Spotify', mkBtnLocal:'Create playlist', selectAllBtn:'Select all', deleteSelectedBtn:'Delete selected', confirmDeleteSelected:'Delete {n} tracks?', notLinkedHint:'※ Not linked to Spotify — saved in the app only.', spotifyLinkText:'Link Spotify', likedTitle:'Liked songs ({n})', likedEmpty:'Tap ♥ on Discover to collect songs here', deleteBtn:'Remove', playlistsTitle:'Created playlists', trackCount:'{n} tracks', matchedSuffix:' · {n} matched on Spotify', playlistsEmpty:'None yet', openBtn:'Open', creating:'Creating…', createdSpotify:'Created on Spotify', createdLocal:'Created', inviteCodeTitle:'Your invite code', copyBtn:'Copy', friendCodePh:"Enter a friend's code", addBtn:'Add', shareLabel:"Share what I'm playing with friends", nowPlayingTitle:'What friends are playing', sourceSpotify:'Spotify', sourceApp:'In-app', playSabiBtn:'▶ Hook', notPlaying:'Not listening right now', friendsEmpty:'Exchange codes to add friends', copied:'Copied', friendAdded:'Added {name}', nowPreviewToast:'♪ {title}', genre_all:'All', genre_jpop:'J-Pop', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/Hip-Hop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternative', genre_jazz:'Jazz', genre_chill:'Chill', genre_viral:'Viral', err_name_required:'Please enter a name', err_code_not_found:'Code not found', err_spotify_not_configured:"Spotify isn't configured", err_spotify_not_linked:'Please link Spotify', err_no_tracks_selected:'Select some tracks first', err_playlist_create_failed:'Failed to create the Spotify playlist', err_unauth:'Please log in', err_not_found:'Not found', err_generic:'Something went wrong', navSettings:'Settings', pinBtn:'Pin', unpinBtn:'Unpin', pinnedToast:'Pinned', unpinnedToast:'Unpinned', settingsTitle:'Settings', languageLabel:'Language', nicknameLabel:'Nickname', saveBtn:'Save', savedToast:'Saved', spotifyLabel:'Spotify connection', spotifyConnected:'Connected', spotifyNotConnected:'Not connected', unlinkBtn:'Unlink', logoutBtn:'Log out', deleteAccountBtn:'Delete account', confirmDeleteAccount:'Delete your account? This cannot be undone.', themeLabel:'Theme', themeSystem:'Match device', themeLight:'Light', themeDark:'Dark', supportTitle:'Support', privacyTitle:'Privacy Policy', termsTitle:'Terms of Service', faqTitle:'FAQ', contactTitle:'Contact', contactBody:'Found a bug or have a suggestion? Reach out anytime.', backBtn:'← Back', a2hsTitle:'Add to your Home Screen', a2hsBody:'Open it full-screen like an app, with one tap.', a2hsIOS:'In Safari, tap the <b>Share button</b> (square with an arrow) → choose "<b>Add to Home Screen</b>"', a2hsAndroid:'Tap the <b>⋮ menu</b> in the top right → choose "<b>Install app</b>" or "<b>Add to Home screen</b>"', a2hsOther:'From your browser menu, choose "<b>Install app</b>" or "<b>Add to Home screen</b>"', a2hsGotIt:'Got it', a2hsSettingsBtn:'How to add to Home Screen', playbackSettingsTitle:'Playback & interaction', bgPlaybackLabel:'Allow background playback', autoplayCardsLabel:'Autoplay new cards', hapticsLabel:'Haptic feedback on swipe', reduceMotionLabel:'Reduce motion', publicLabel:'Share with friends', friendPlaylistsTitle:"Friends' playlists", madePublicToast:'Shared with friends', madePrivateToast:'Made private', artistLabel:'Artist', deselectAllBtn:'Deselect all', genre_kpop:'K-Pop', feedbackBtn:'Send feedback', feedbackTitle:'Feedback', feedbackIntro:'Tell us your ideas, requests, or bugs so we can make Swipee better.', fbCatIdea:'Idea or request', fbCatBug:'Bug report', fbCatOther:'Other', fbMsgPh:'Write your feedback here', fbContactPh:'Email if you want a reply (optional)', fbSend:'Send', fbSent:'Thank you! Sent', fbNote:'Your message (with your nickname and device info) is used only to improve the service.', err_message_required:'Please write a message', err_rate_limited:'Too many submissions. Please try again later'},
  ko: {langName:'한국어', tagline:'후렴만 듣고 좋아하는 곡을 발견하세요.<br>친구가 지금 듣고 있는 곡도 볼 수 있어요.', spotifyStart:'Spotify로 시작하기', spotifyBetaNote:'※ Spotify 연동은 현재 테스터 한정으로 제공 중이에요', orTry:'또는 (Spotify 연동 없이 체험하기)', nickname:'닉네임', start:'시작하기', searchPh:'아티스트·곡명 검색', discoverHint:'← 스킵 / → 좋아요 / 스페이스 재생·정지 / Z 되돌리기 (30초 미리듣기=후렴 부근)', navDiscover:'발견', navLibrary:'보관함', navFriends:'친구', noTracksFound:'곡을 찾을 수 없어요', tapToPlay:'▶ 탭해서 후렴 재생', likedAdded:'♥ 보관함에 추가됨', likeBadge:'좋아요', skipBadge:'스킵', nothingToUndo:'되돌릴 스와이프가 없어요', undoToast:'↩ 되돌렸어요', libCreateTitle:'플레이리스트 만들기', plNamePh:'플레이리스트 이름', plDefaultPrefix:'Swipee', plDesc:'Swipee로 생성', mixLabel:'비슷한 곡을 자동으로 추가해 30곡으로 채우기', mkBtnSpotify:'Spotify에 플레이리스트 만들기', mkBtnLocal:'플레이리스트 만들기', selectAllBtn:'전체 선택', deleteSelectedBtn:'선택한 곡 삭제', confirmDeleteSelected:'{n}곡을 삭제할까요?', notLinkedHint:'※ Spotify 미연동 상태라 앱 안에만 저장돼요.', spotifyLinkText:'Spotify 연동하기', likedTitle:'좋아요한 곡 ({n})', likedEmpty:'발견 탭에서 ♥를 누르면 여기에 모여요', deleteBtn:'삭제', playlistsTitle:'만든 플레이리스트', trackCount:'{n}곡', matchedSuffix:' · Spotify에서 {n}곡 일치', playlistsEmpty:'아직 없어요', openBtn:'열기', creating:'만드는 중…', createdSpotify:'Spotify에 만들었어요', createdLocal:'만들었어요', inviteCodeTitle:'내 초대 코드', copyBtn:'복사', friendCodePh:'친구 코드 입력', addBtn:'추가', shareLabel:'내가 듣는 곡을 친구에게 공유', nowPlayingTitle:'친구가 지금 듣는 곡', sourceSpotify:'Spotify', sourceApp:'앱 내', playSabiBtn:'▶ 후렴', notPlaying:'지금은 듣고 있지 않아요', friendsEmpty:'코드를 교환해서 친구를 추가해보세요', copied:'복사했어요', friendAdded:'{name}님을 추가했어요', nowPreviewToast:'♪ {title}', genre_all:'전체', genre_jpop:'J-POP', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'랩/힙합', genre_rnb:'R&B', genre_dance:'댄스', genre_electro:'일렉트로', genre_alternative:'얼터너티브', genre_jazz:'재즈', genre_chill:'칠(잔잔한)', genre_viral:'바이럴(SNS 인기)', err_name_required:'이름을 입력해주세요', err_code_not_found:'코드를 찾을 수 없어요', err_spotify_not_configured:'Spotify 연동이 설정되지 않았어요', err_spotify_not_linked:'Spotify를 연동해주세요', err_no_tracks_selected:'곡을 선택해주세요', err_playlist_create_failed:'Spotify 플레이리스트 생성에 실패했어요', err_unauth:'로그인해주세요', err_not_found:'찾을 수 없어요', err_generic:'오류가 발생했어요', navSettings:'설정', pinBtn:'고정', unpinBtn:'고정 해제', pinnedToast:'고정했어요', unpinnedToast:'고정을 해제했어요', settingsTitle:'설정', languageLabel:'언어', nicknameLabel:'닉네임', saveBtn:'저장', savedToast:'저장했어요', spotifyLabel:'Spotify 연동', spotifyConnected:'연동됨', spotifyNotConnected:'미연동', unlinkBtn:'연동 해제', logoutBtn:'로그아웃', deleteAccountBtn:'계정 삭제', confirmDeleteAccount:'계정을 삭제할까요? 이 작업은 되돌릴 수 없어요.', themeLabel:'테마', themeSystem:'기기 설정에 맞춤', themeLight:'라이트', themeDark:'다크', supportTitle:'지원', privacyTitle:'개인정보 처리방침', termsTitle:'이용약관', faqTitle:'자주 묻는 질문', contactTitle:'문의하기', contactBody:'버그 제보나 제안이 있으시면 언제든 연락해주세요.', backBtn:'← 뒤로', a2hsTitle:'홈 화면에 추가하기', a2hsBody:'앱처럼 전체 화면으로 한 번에 열 수 있어요.', a2hsIOS:'Safari에서 하단의 <b>공유 버튼</b>(네모와 화살표)을 탭 →「<b>홈 화면에 추가</b>」 선택', a2hsAndroid:'오른쪽 위 <b>⋮ 메뉴</b>를 탭 →「<b>앱 설치</b>」 또는「<b>홈 화면에 추가</b>」 선택', a2hsOther:'브라우저 메뉴에서「<b>앱 설치</b>」 또는「<b>홈 화면에 추가</b>」를 선택하세요', a2hsGotIt:'확인', a2hsSettingsBtn:'홈 화면에 추가하는 방법', playbackSettingsTitle:'재생·조작 설정', bgPlaybackLabel:'백그라운드 재생 허용', autoplayCardsLabel:'새 카드 자동 재생', hapticsLabel:'스와이프 시 진동 피드백', reduceMotionLabel:'애니메이션 줄이기', publicLabel:'친구에게 공개', friendPlaylistsTitle:'친구의 플레이리스트', madePublicToast:'친구에게 공개했어요', madePrivateToast:'비공개로 전환했어요', artistLabel:'아티스트', deselectAllBtn:'전체 해제', genre_kpop:'K-POP', feedbackBtn:'피드백·요청 보내기', feedbackTitle:'피드백', feedbackIntro:'Swipee를 더 좋게 만들 수 있도록 의견, 요청, 버그를 알려주세요.', fbCatIdea:'요청·아이디어', fbCatBug:'버그 신고', fbCatOther:'기타', fbMsgPh:'내용을 입력해주세요', fbContactPh:'답장이 필요하면 이메일 (선택)', fbSend:'보내기', fbSent:'감사합니다! 전송했어요', fbNote:'보낸 내용(닉네임·기기 정보 포함)은 서비스 개선 목적으로만 사용돼요.', err_message_required:'내용을 입력해주세요', err_rate_limited:'전송이 너무 많아요. 잠시 후 다시 시도해주세요'},
  zh: {langName:'中文', tagline:'只听副歌,发现你喜欢的歌。<br>还能看到朋友现在在听什么。', spotifyStart:'使用 Spotify 开始', spotifyBetaNote:'※ Spotify 连接目前仅限测试用户使用', orTry:'或(不连接 Spotify 体验)', nickname:'昵称', start:'开始', searchPh:'搜索歌手或歌曲', discoverHint:'← 跳过 / → 喜欢 / 空格 播放·暂停 / Z 撤销(30秒预览≈副歌部分)', navDiscover:'发现', navLibrary:'音乐库', navFriends:'朋友', noTracksFound:'没有找到歌曲', tapToPlay:'▶ 点击播放副歌', likedAdded:'♥ 已加入音乐库', likeBadge:'喜欢', skipBadge:'跳过', nothingToUndo:'没有可撤销的操作', undoToast:'↩ 已撤销', libCreateTitle:'创建歌单', plNamePh:'歌单名称', plDefaultPrefix:'Swipee', plDesc:'由 Swipee 创建', mixLabel:'自动加入相似歌曲,凑满30首', mkBtnSpotify:'在 Spotify 创建歌单', mkBtnLocal:'创建歌单', selectAllBtn:'全选', deleteSelectedBtn:'删除所选', confirmDeleteSelected:'删除{n}首歌曲?', notLinkedHint:'※ 未连接 Spotify,将仅保存在应用内。', spotifyLinkText:'连接 Spotify', likedTitle:'喜欢的歌曲 ({n})', likedEmpty:'在发现页点♥收藏歌曲吧', deleteBtn:'删除', playlistsTitle:'已创建的歌单', trackCount:'{n}首', matchedSuffix:' · 在 Spotify 匹配到{n}首', playlistsEmpty:'暂无', openBtn:'打开', creating:'创建中…', createdSpotify:'已在 Spotify 创建', createdLocal:'已创建', inviteCodeTitle:'你的邀请码', copyBtn:'复制', friendCodePh:'输入朋友的邀请码', addBtn:'添加', shareLabel:'把我正在听的歌分享给朋友', nowPlayingTitle:'朋友正在听的歌', sourceSpotify:'Spotify', sourceApp:'应用内', playSabiBtn:'▶ 副歌', notPlaying:'现在没有在听', friendsEmpty:'交换邀请码来添加朋友吧', copied:'已复制', friendAdded:'已添加 {name}', nowPreviewToast:'♪ {title}', genre_all:'全部', genre_jpop:'J-POP', genre_pop:'流行', genre_rock:'摇滚', genre_rap:'说唱/嘻哈', genre_rnb:'R&B', genre_dance:'舞曲', genre_electro:'电子', genre_alternative:'另类', genre_jazz:'爵士', genre_chill:'Chill(放松)', genre_viral:'热门爆款', err_name_required:'请输入名字', err_code_not_found:'未找到该邀请码', err_spotify_not_configured:'尚未配置 Spotify 连接', err_spotify_not_linked:'请先连接 Spotify', err_no_tracks_selected:'请先选择歌曲', err_playlist_create_failed:'创建 Spotify 歌单失败', err_unauth:'请先登录', err_not_found:'未找到', err_generic:'出错了', navSettings:'设置', pinBtn:'置顶', unpinBtn:'取消置顶', pinnedToast:'已置顶', unpinnedToast:'已取消置顶', settingsTitle:'设置', languageLabel:'语言', nicknameLabel:'昵称', saveBtn:'保存', savedToast:'已保存', spotifyLabel:'Spotify 连接', spotifyConnected:'已连接', spotifyNotConnected:'未连接', unlinkBtn:'取消连接', logoutBtn:'退出登录', deleteAccountBtn:'删除账户', confirmDeleteAccount:'删除账户?此操作无法撤销。', themeLabel:'主题', themeSystem:'跟随设备', themeLight:'浅色', themeDark:'深色', supportTitle:'支持', privacyTitle:'隐私政策', termsTitle:'服务条款', faqTitle:'常见问题', contactTitle:'联系我们', contactBody:'发现问题或有建议?欢迎随时联系。', backBtn:'← 返回', a2hsTitle:'添加到主屏幕', a2hsBody:'像App一样全屏打开,一点即达。', a2hsIOS:'在Safari中点击底部的<b>分享按钮</b>(方框加箭头) → 选择"<b>添加到主屏幕</b>"', a2hsAndroid:'点击右上角的<b>⋮菜单</b> → 选择"<b>安装应用</b>"或"<b>添加到主屏幕</b>"', a2hsOther:'在浏览器菜单中选择"<b>安装应用</b>"或"<b>添加到主屏幕</b>"', a2hsGotIt:'知道了', a2hsSettingsBtn:'如何添加到主屏幕', playbackSettingsTitle:'播放与操作设置', bgPlaybackLabel:'允许后台播放', autoplayCardsLabel:'自动播放新卡片', hapticsLabel:'滑动时震动反馈', reduceMotionLabel:'减少动画效果', publicLabel:'对朋友公开', friendPlaylistsTitle:'朋友的歌单', madePublicToast:'已对朋友公开', madePrivateToast:'已设为不公开', artistLabel:'艺人', deselectAllBtn:'取消全选', genre_kpop:'K-POP', feedbackBtn:'发送反馈与建议', feedbackTitle:'反馈', feedbackIntro:'欢迎告诉我们您的想法、建议或遇到的问题,帮助 Swipee 变得更好。', fbCatIdea:'建议·想法', fbCatBug:'问题反馈', fbCatOther:'其他', fbMsgPh:'请输入反馈内容', fbContactPh:'如需回复,请留下邮箱(选填)', fbSend:'发送', fbSent:'谢谢!已发送', fbNote:'所发送的内容(包含昵称和设备信息)仅用于改进服务。', err_message_required:'请输入内容', err_rate_limited:'发送过于频繁,请稍后再试'},
  es: {langName:'Español', tagline:'Escucha el estribillo y descubre canciones que te encantarán.<br>Mira qué está escuchando tu amigos ahora mismo.', spotifyStart:'Empezar con Spotify', spotifyBetaNote:'※ Spotify está en beta limitada (solo testers por ahora)', orTry:'o pruébalo sin conectar Spotify', nickname:'Apodo', start:'Empezar', searchPh:'Buscar artista o canción', discoverHint:'← Saltar / → Me gusta / Espacio Reproducir-Pausar / Z Deshacer (avance de 30s ≈ el estribillo)', navDiscover:'Descubrir', navLibrary:'Biblioteca', navFriends:'Amigos', noTracksFound:'No se encontraron canciones', tapToPlay:'▶ Toca para escuchar el estribillo', likedAdded:'♥ Añadido a la biblioteca', likeBadge:'Me gusta', skipBadge:'Saltar', nothingToUndo:'No hay nada que deshacer', undoToast:'↩ Deshecho', libCreateTitle:'Crear una playlist', plNamePh:'Nombre de la playlist', plDefaultPrefix:'Swipee', plDesc:'Creado con Swipee', mixLabel:'Añadir canciones similares automáticamente hasta 30', mkBtnSpotify:'Crear en Spotify', mkBtnLocal:'Crear playlist', selectAllBtn:'Seleccionar todo', deleteSelectedBtn:'Eliminar seleccionadas', confirmDeleteSelected:'¿Eliminar {n} canciones?', notLinkedHint:'※ Como no está conectado Spotify, se guarda solo en la app.', spotifyLinkText:'Conectar Spotify', likedTitle:'Canciones con me gusta ({n})', likedEmpty:'Toca ♥ en Descubrir para guardar canciones aquí', deleteBtn:'Quitar', playlistsTitle:'Playlists creadas', trackCount:'{n} canciones', matchedSuffix:' · {n} encontradas en Spotify', playlistsEmpty:'Todavía no hay ninguna', openBtn:'Abrir', creating:'Creando…', createdSpotify:'Creada en Spotify', createdLocal:'Creada', inviteCodeTitle:'Tu código de invitación', copyBtn:'Copiar', friendCodePh:'Escribe el código de un amigo', addBtn:'Añadir', shareLabel:'Compartir lo que escucho con mis amigos', nowPlayingTitle:'Lo que están escuchando tus amigos', sourceSpotify:'Spotify', sourceApp:'En la app', playSabiBtn:'▶ Estribillo', notPlaying:'Ahora mismo no está escuchando nada', friendsEmpty:'Intercambia códigos para añadir amigos', copied:'Copiado', friendAdded:'Se añadió a {name}', nowPreviewToast:'♪ {title}', genre_all:'Todo', genre_jpop:'J-Pop', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/Hip-Hop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Electro', genre_alternative:'Alternativa', genre_jazz:'Jazz', genre_chill:'Chill', genre_viral:'Viral', err_name_required:'Por favor, introduce un nombre', err_code_not_found:'Código no encontrado', err_spotify_not_configured:'Spotify no está configurado', err_spotify_not_linked:'Conecta Spotify, por favor', err_no_tracks_selected:'Selecciona alguna canción primero', err_playlist_create_failed:'No se pudo crear la playlist en Spotify', err_unauth:'Inicia sesión, por favor', err_not_found:'No encontrado', err_generic:'Ocurrió un error', navSettings:'Ajustes', pinBtn:'Fijar', unpinBtn:'Dejar de fijar', pinnedToast:'Fijado', unpinnedToast:'Ya no está fijado', settingsTitle:'Ajustes', languageLabel:'Idioma', nicknameLabel:'Apodo', saveBtn:'Guardar', savedToast:'Guardado', spotifyLabel:'Conexión con Spotify', spotifyConnected:'Conectado', spotifyNotConnected:'No conectado', unlinkBtn:'Desconectar', logoutBtn:'Cerrar sesión', deleteAccountBtn:'Eliminar cuenta', confirmDeleteAccount:'¿Eliminar tu cuenta? Esta acción no se puede deshacer.', themeLabel:'Tema', themeSystem:'Igual que el dispositivo', themeLight:'Claro', themeDark:'Oscuro', supportTitle:'Ayuda', privacyTitle:'Política de privacidad', termsTitle:'Términos del servicio', faqTitle:'Preguntas frecuentes', contactTitle:'Contacto', contactBody:'¿Encontraste un error o tienes una sugerencia? Escríbenos cuando quieras.', backBtn:'← Atrás', a2hsTitle:'Añádela a tu pantalla de inicio', a2hsBody:'Ábrela a pantalla completa, como una app, con un solo toque.', a2hsIOS:'En Safari, toca el <b>botón Compartir</b> (un cuadrado con una flecha) → elige "<b>Añadir a pantalla de inicio</b>"', a2hsAndroid:'Toca el <b>menú ⋮</b> arriba a la derecha → elige "<b>Instalar app</b>" o "<b>Añadir a pantalla de inicio</b>"', a2hsOther:'Desde el menú de tu navegador, elige "<b>Instalar app</b>" o "<b>Añadir a pantalla de inicio</b>"', a2hsGotIt:'Entendido', a2hsSettingsBtn:'Cómo añadir a la pantalla de inicio', playbackSettingsTitle:'Reproducción e interacción', bgPlaybackLabel:'Permitir reproducción en segundo plano', autoplayCardsLabel:'Reproducir automáticamente las nuevas tarjetas', hapticsLabel:'Vibración al deslizar', reduceMotionLabel:'Reducir las animaciones', publicLabel:'Compartir con amigos', friendPlaylistsTitle:'Playlists de tus amigos', madePublicToast:'Compartida con amigos', madePrivateToast:'Ahora es privada', artistLabel:'Artista', deselectAllBtn:'Deseleccionar todo', genre_kpop:'K-Pop', feedbackBtn:'Enviar comentarios', feedbackTitle:'Comentarios', feedbackIntro:'Cuéntanos tus ideas, peticiones o errores para mejorar Swipee.', fbCatIdea:'Idea o petición', fbCatBug:'Informe de error', fbCatOther:'Otro', fbMsgPh:'Escribe aquí tus comentarios', fbContactPh:'Correo si quieres respuesta (opcional)', fbSend:'Enviar', fbSent:'¡Gracias! Enviado', fbNote:'Tu mensaje (con apodo e información del dispositivo) solo se usa para mejorar el servicio.', err_message_required:'Escribe un mensaje', err_rate_limited:'Demasiados envíos. Inténtalo más tarde'},
  fr: {langName:'Français', tagline:"Écoute le refrain, découvre des chansons que tu vas adorer.<br>Vois ce que tes amis écoutent en ce moment.", spotifyStart:'Commencer avec Spotify', spotifyBetaNote:"※ Spotify est en bêta limitée (testeurs uniquement pour le moment)", orTry:"ou essaie sans Spotify", nickname:'Pseudo', start:'Commencer', searchPh:'Rechercher un artiste ou un titre', discoverHint:"← Passer / → J'aime / Espace Lecture-Pause / Z Annuler (extrait de 30s ≈ le refrain)", navDiscover:'Découvrir', navLibrary:'Bibliothèque', navFriends:'Amis', noTracksFound:'Aucun morceau trouvé', tapToPlay:'▶ Toucher pour écouter le refrain', likedAdded:"♥ Ajouté à la bibliothèque", likeBadge:"J'aime", skipBadge:'Passer', nothingToUndo:'Rien à annuler', undoToast:'↩ Annulé', libCreateTitle:'Créer une playlist', plNamePh:'Nom de la playlist', plDefaultPrefix:'Swipee', plDesc:'Créé avec Swipee', mixLabel:"Ajouter automatiquement des titres similaires jusqu'à 30 chansons", mkBtnSpotify:'Créer sur Spotify', mkBtnLocal:'Créer la playlist', selectAllBtn:'Tout sélectionner', deleteSelectedBtn:'Supprimer la sélection', confirmDeleteSelected:'Supprimer {n} titres ?', notLinkedHint:"※ Non connecté à Spotify — enregistré uniquement dans l'app.", spotifyLinkText:'Connecter Spotify', likedTitle:'Titres aimés ({n})', likedEmpty:'Touche ♥ dans Découvrir pour rassembler des titres ici', deleteBtn:'Retirer', playlistsTitle:'Playlists créées', trackCount:'{n} titres', matchedSuffix:' · {n} trouvés sur Spotify', playlistsEmpty:'Aucune pour le moment', openBtn:'Ouvrir', creating:'Création…', createdSpotify:'Créée sur Spotify', createdLocal:'Créée', inviteCodeTitle:"Ton code d'invitation", copyBtn:'Copier', friendCodePh:"Entre le code d'un ami", addBtn:'Ajouter', shareLabel:"Partager ce que j'écoute avec mes amis", nowPlayingTitle:'Ce que tes amis écoutent', sourceSpotify:'Spotify', sourceApp:"Dans l'app", playSabiBtn:'▶ Refrain', notPlaying:"N'écoute rien en ce moment", friendsEmpty:'Échangez vos codes pour ajouter des amis', copied:'Copié', friendAdded:'{name} ajouté', nowPreviewToast:'♪ {title}', genre_all:'Tout', genre_jpop:'J-Pop', genre_pop:'Pop', genre_rock:'Rock', genre_rap:'Rap/Hip-Hop', genre_rnb:'R&B', genre_dance:'Dance', genre_electro:'Électro', genre_alternative:'Alternative', genre_jazz:'Jazz', genre_chill:'Chill', genre_viral:'Viral', err_name_required:"Merci d'entrer un nom", err_code_not_found:'Code introuvable', err_spotify_not_configured:"Spotify n'est pas configuré", err_spotify_not_linked:'Merci de connecter Spotify', err_no_tracks_selected:"Sélectionne d'abord des titres", err_playlist_create_failed:'Échec de la création de la playlist Spotify', err_unauth:'Merci de te connecter', err_not_found:'Introuvable', err_generic:'Une erreur est survenue', navSettings:'Réglages', pinBtn:'Épingler', unpinBtn:'Désépingler', pinnedToast:'Épinglé', unpinnedToast:'Désépinglé', settingsTitle:'Réglages', languageLabel:'Langue', nicknameLabel:'Pseudo', saveBtn:'Enregistrer', savedToast:'Enregistré', spotifyLabel:'Connexion Spotify', spotifyConnected:'Connecté', spotifyNotConnected:'Non connecté', unlinkBtn:'Déconnecter', logoutBtn:'Se déconnecter', deleteAccountBtn:'Supprimer le compte', confirmDeleteAccount:'Supprimer ton compte ? Cette action est irréversible.', themeLabel:'Thème', themeSystem:"Suivre l'appareil", themeLight:'Clair', themeDark:'Sombre', supportTitle:'Aide', privacyTitle:'Politique de confidentialité', termsTitle:"Conditions d'utilisation", faqTitle:'FAQ', contactTitle:'Contact', contactBody:'Un bug à signaler ou une suggestion ? Écris-nous quand tu veux.', backBtn:'← Retour', a2hsTitle:"Ajoute-la à ton écran d'accueil", a2hsBody:"Ouvre-la en plein écran comme une app, en un geste.", a2hsIOS:"Dans Safari, appuie sur le <b>bouton Partager</b> (un carré avec une flèche) → choisis « <b>Sur l'écran d'accueil</b> »", a2hsAndroid:"Appuie sur le <b>menu ⋮</b> en haut à droite → choisis « <b>Installer l'appli</b> » ou « <b>Ajouter à l'écran d'accueil</b> »", a2hsOther:"Depuis le menu de ton navigateur, choisis « <b>Installer l'appli</b> » ou « <b>Ajouter à l'écran d'accueil</b> »", a2hsGotIt:'Compris', a2hsSettingsBtn:"Comment l'ajouter à l'écran d'accueil", playbackSettingsTitle:'Lecture et interaction', bgPlaybackLabel:'Autoriser la lecture en arrière-plan', autoplayCardsLabel:'Lecture automatique des nouvelles cartes', hapticsLabel:'Vibration lors du balayage', reduceMotionLabel:'Réduire les animations', publicLabel:'Partager avec mes amis', friendPlaylistsTitle:'Playlists de tes amis', madePublicToast:'Partagée avec tes amis', madePrivateToast:'Rendue privée', artistLabel:'Artiste', deselectAllBtn:'Tout désélectionner', genre_kpop:'K-Pop', feedbackBtn:'Envoyer un retour', feedbackTitle:'Retour', feedbackIntro:'Dis-nous tes idées, demandes ou bugs pour améliorer Swipee.', fbCatIdea:'Idée ou demande', fbCatBug:'Signaler un bug', fbCatOther:'Autre', fbMsgPh:'Écris ton retour ici', fbContactPh:'E-mail si tu veux une réponse (facultatif)', fbSend:'Envoyer', fbSent:'Merci ! Envoyé', fbNote:'Ton message (avec ton pseudo et des infos sur ton appareil) sert uniquement à améliorer le service.', err_message_required:'Écris un message', err_rate_limited:"Trop d'envois. Réessaie plus tard"},
};
const SUPPORTED = Object.keys(LANGS);
const LOCALE_TAG = {ja:'ja-JP', en:'en-US', ko:'ko-KR', zh:'zh-CN', es:'es-ES', fr:'fr-FR'};
const CONTACT_EMAIL = 'swipee@outlook.jp';

// ---- プライバシーポリシー・利用規約・FAQ ----
const LEGAL = {
  ja: {
    privacy: [
      '<p>Swipeeが扱う情報は次の通りです: ニックネーム、Spotifyと連携した場合のアカウント情報(トークンを含む)、♥した曲、作成したプレイリスト、友達リスト、そして今聴いている曲の情報です。これらはアプリの機能(発見・ライブラリ・友達との共有)を提供するためだけに使います。</p>',
      '<p>曲の検索やプレビュー再生にはDeezerの公開APIを、Spotify連携時のプレイリスト作成・再生中の取得にはSpotify Web APIを利用します。それぞれのサービスの利用規約・プライバシーポリシーも適用されます。</p>',
      '<p>保存先はPostgresデータベース(または連携していない場合はサーバー上のファイル)です。ログイン状態を保つためのセッションCookieのみを使用し、広告目的のトラッキングや第三者への情報提供は行いません。</p>',
      '<p>「今聴いている曲」は、共有をONにしている友達にのみ表示されます。設定からいつでもOFFにできます。</p>',
      '<p>設定の「アカウントを削除」から、いいね・プレイリスト・友達関係を含むすべてのデータを削除できます。</p>',
      `<p>ご質問は <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> までご連絡ください。</p>`,
    ].join(''),
    terms: [
      '<p>Swipeeは個人が開発・運営する無料のサービスです。動作の継続性や完全性を保証するものではなく、予告なく内容が変更・停止される場合があります。</p>',
      '<p>不正アクセス、サービスの妨害、著作権で保護された音源データの不正な複製・再配布など、法令や各種サービスの利用規約に反する行為は禁止します。</p>',
      '<p>Spotifyを連携して利用する場合は、Spotifyの利用規約にも従う必要があります。楽曲データの取得にはDeezerの公開APIを利用しています。</p>',
      '<p>本サービスの利用により生じた損害について、運営者は一切の責任を負いません(現状有姿でのご提供となります)。</p>',
      `<p>本規約に関するお問い合わせは <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> までお願いします。</p>`,
    ].join(''),
    faq: [
      {q:'Spotifyアカウントがなくても使えますか?', a:'はい、ニックネームだけで始められます。発見・いいね・ライブラリ・友達機能はどなたでも使えます。なお、プレイリストの自動作成やSpotify再生中の共有に使うSpotify連携は、現在テスター限定で提供中です(審査通過後に拡大予定)。'},
      {q:'「サビ」はどうやって検出していますか?', a:'曲の正確なサビ区間を解析しているわけではありません。Deezerが提供する30秒のプレビュー(曲の聴きどころ部分)を再生しています。'},
      {q:'友達には何が見えますか?', a:'あなたが今聴いている曲のタイトルとアーティストだけです。いいねした曲の一覧や過去の履歴は見えません。設定からいつでも共有をOFFにできます。'},
      {q:'データを全部消したい場合は?', a:'設定の「アカウントを削除」から、いいね・プレイリスト・友達関係を含めてすべて削除できます。この操作は取り消せません。'},
      {q:'無料ですか?広告はありますか?', a:'無料で、広告もありません。'},
      {q:'不具合や要望はどこに送ればいいですか?', a:`${CONTACT_EMAIL} までご連絡ください。`},
    ],
  },
  en: {
    privacy: [
      '<p>Swipee handles the following information: your nickname, Spotify account details (including tokens) if you link it, songs you\'ve liked, playlists you create, your friends list, and what you\'re currently playing. This is used solely to provide the app\'s features (discovery, library, and sharing with friends).</p>',
      "<p>Song search and previews use Deezer's public API; playlist creation and now-playing retrieval (when Spotify is linked) use the Spotify Web API. Each service's own terms and privacy policy also apply.</p>",
      '<p>Data is stored in a Postgres database (or a file on the server if not linked). We only use a session cookie to keep you signed in — no advertising trackers, and we don\'t share your data with third parties.</p>',
      '<p>"What you\'re playing" is only shown to friends who have sharing turned on for you to see. You can turn this off anytime in Settings.</p>',
      '<p>You can delete all your data — likes, playlists, and friend connections — from "Delete account" in Settings.</p>',
      `<p>Questions? Reach us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    terms: [
      '<p>Swipee is a free service built and operated by an individual developer. We don\'t guarantee uninterrupted or error-free operation, and features may change or be discontinued without notice.</p>',
      "<p>You may not use the service to gain unauthorized access, disrupt it, or illegally copy or redistribute copyrighted audio data, or otherwise violate applicable law or any linked service's terms.</p>",
      "<p>If you link Spotify, you must also comply with Spotify's own Terms of Service. Track data is retrieved via Deezer's public API.</p>",
      '<p>The service is provided "as is," and the operator is not liable for any damages arising from its use.</p>',
      `<p>For questions about these terms, contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    faq: [
      {q:'Can I use it without a Spotify account?', a:"Yes — a nickname is all you need to start. Discovery, likes, library, and friends are open to everyone. Spotify linking (auto-creating playlists, sharing Spotify now-playing) is currently limited-beta, testers only, pending review for wider access."},
      {q:'How is the "hook" detected?', a:"We don't analyze the exact chorus. We play Deezer's 30-second preview, which is usually the catchiest part of the track."},
      {q:'What can my friends see?', a:'Only the title and artist of what you\'re currently playing — not your full liked list or history. You can turn sharing off anytime in Settings.'},
      {q:'How do I delete all my data?', a:'Use "Delete account" in Settings to remove everything — likes, playlists, and friend connections. This can\'t be undone.'},
      {q:'Is it free? Are there ads?', a:'Yes, it\'s free, and there are no ads.'},
      {q:'Where do I report a bug or send feedback?', a:`Email us at ${CONTACT_EMAIL}.`},
    ],
  },
  ko: {
    privacy: [
      '<p>Swipee는 다음 정보를 다룹니다: 닉네임, Spotify 연동 시 계정 정보(토큰 포함), 좋아요한 곡, 만든 플레이리스트, 친구 목록, 현재 재생 중인 곡 정보입니다. 이는 오직 앱의 기능(발견·보관함·친구 공유)을 제공하기 위해서만 사용됩니다.</p>',
      '<p>곡 검색과 미리듣기에는 Deezer 공개 API를, Spotify 연동 시 플레이리스트 생성과 재생 정보 가져오기에는 Spotify Web API를 사용합니다. 각 서비스의 약관과 개인정보처리방침도 함께 적용됩니다.</p>',
      '<p>데이터는 Postgres 데이터베이스(미연동 시에는 서버의 파일)에 저장됩니다. 로그인 유지를 위한 세션 쿠키만 사용하며, 광고 목적의 추적이나 제3자 제공은 하지 않습니다.</p>',
      '<p>"지금 듣는 곡"은 공유를 켜둔 친구에게만 보입니다. 설정에서 언제든 끌 수 있습니다.</p>',
      '<p>설정의 "계정 삭제"를 통해 좋아요, 플레이리스트, 친구 관계를 포함한 모든 데이터를 삭제할 수 있습니다.</p>',
      `<p>문의사항은 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>로 연락해주세요.</p>`,
    ].join(''),
    terms: [
      '<p>Swipee는 개인이 개발·운영하는 무료 서비스입니다. 서비스의 지속성이나 완전성을 보장하지 않으며, 예고 없이 내용이 변경되거나 중단될 수 있습니다.</p>',
      '<p>무단 접근, 서비스 방해, 저작권으로 보호된 음원 데이터의 불법 복제·재배포 등 관련 법령이나 각 서비스 약관을 위반하는 행위는 금지됩니다.</p>',
      '<p>Spotify를 연동해 이용하는 경우 Spotify 자체의 이용약관도 준수해야 합니다. 곡 데이터는 Deezer 공개 API를 통해 가져옵니다.</p>',
      '<p>본 서비스는 "있는 그대로" 제공되며, 운영자는 서비스 이용으로 발생한 손해에 대해 책임을 지지 않습니다.</p>',
      `<p>약관 관련 문의는 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>로 부탁드립니다.</p>`,
    ].join(''),
    faq: [
      {q:'Spotify 계정이 없어도 쓸 수 있나요?', a:'네, 닉네임만으로 시작할 수 있어요. 발견·좋아요·보관함·친구 기능은 누구나 쓸 수 있어요. 플레이리스트 자동 생성이나 Spotify 재생 중 공유에 쓰이는 Spotify 연동은 현재 테스터 한정으로 제공 중이에요(심사 통과 후 확대 예정).'},
      {q:'"후렴"은 어떻게 찾아내나요?', a:'곡의 정확한 후렴 구간을 분석하는 것은 아니에요. Deezer가 제공하는 30초 미리듣기(곡의 하이라이트 부분)를 재생합니다.'},
      {q:'친구에게는 무엇이 보이나요?', a:'지금 듣고 있는 곡의 제목과 아티스트만 보여요. 좋아요 목록 전체나 과거 기록은 보이지 않아요. 설정에서 언제든 공유를 끌 수 있어요.'},
      {q:'데이터를 전부 지우고 싶어요.', a:'설정의 "계정 삭제"에서 좋아요, 플레이리스트, 친구 관계를 포함해 모두 삭제할 수 있어요. 이 작업은 되돌릴 수 없어요.'},
      {q:'무료인가요? 광고가 있나요?', a:'무료이고, 광고도 없어요.'},
      {q:'버그 제보나 요청은 어디로 보내나요?', a:`${CONTACT_EMAIL}로 연락해주세요.`},
    ],
  },
  zh: {
    privacy: [
      '<p>Swipee 会处理以下信息:昵称、连接 Spotify 后的账户信息(含令牌)、你喜欢的歌曲、创建的歌单、好友列表,以及你当前播放的歌曲信息。这些信息仅用于提供应用的功能(发现、音乐库、与好友分享)。</p>',
      '<p>歌曲搜索与试听使用 Deezer 公开 API;连接 Spotify 后的歌单创建与播放状态获取使用 Spotify Web API。两者各自的条款与隐私政策同样适用。</p>',
      '<p>数据保存在 Postgres 数据库中(未连接数据库时则保存在服务器文件中)。我们仅使用会话 Cookie 来维持登录状态,不进行广告追踪,也不会向第三方提供数据。</p>',
      '<p>"正在播放"只会显示给开启了分享的好友。你可以随时在设置中关闭。</p>',
      '<p>你可以在设置的"删除账户"中删除包括喜欢的歌曲、歌单、好友关系在内的所有数据。</p>',
      `<p>如有疑问,请联系 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>。</p>`,
    ].join(''),
    terms: [
      '<p>Swipee 是由个人开发和运营的免费服务。我们不保证服务持续可用或完全无误,功能可能在不另行通知的情况下变更或终止。</p>',
      '<p>禁止未经授权访问、干扰服务,或非法复制、再分发受版权保护的音频数据,以及任何违反法律法规或相关服务条款的行为。</p>',
      '<p>如果你连接 Spotify,还需遵守 Spotify 自身的服务条款。歌曲数据通过 Deezer 公开 API 获取。</p>',
      '<p>本服务按"现状"提供,运营者对因使用本服务而产生的任何损失不承担责任。</p>',
      `<p>有关本条款的问题,请联系 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>。</p>`,
    ].join(''),
    faq: [
      {q:'没有 Spotify 账户也能用吗?', a:'可以,只需要昵称就能开始使用。发现、喜欢、音乐库、朋友功能所有人都能用。自动创建歌单、分享 Spotify 正在播放这些功能所需的 Spotify 连接,目前仅限测试用户使用(审核通过后将扩大开放)。'},
      {q:'"副歌"是怎么判断的?', a:'并不是精确分析歌曲的副歌片段,而是播放 Deezer 提供的 30 秒试听(通常是歌曲最抓耳的部分)。'},
      {q:'好友能看到我的什么信息?', a:'只能看到你当前播放歌曲的标题和歌手,看不到你完整的收藏列表或历史记录。你可以随时在设置中关闭分享。'},
      {q:'想删除全部数据怎么办?', a:'在设置的"删除账户"中,可以删除包括喜欢的歌曲、歌单、好友关系在内的所有数据,此操作无法撤销。'},
      {q:'免费吗?有广告吗?', a:'完全免费,没有广告。'},
      {q:'在哪里反馈问题或建议?', a:`请联系 ${CONTACT_EMAIL}。`},
    ],
  },
  es: {
    privacy: [
      '<p>Swipee trata la siguiente información: tu apodo, los datos de tu cuenta de Spotify (incluidos los tokens) si la conectas, las canciones que te gustan, las playlists que creas, tu lista de amigos y lo que estás escuchando en este momento. Esto se usa únicamente para ofrecer las funciones de la app (descubrir, biblioteca y compartir con amigos).</p>',
      '<p>La búsqueda y las vistas previas usan la API pública de Deezer; la creación de playlists y la obtención de lo que estás escuchando (con Spotify conectado) usan la API Web de Spotify. También se aplican los términos y la política de privacidad de cada servicio.</p>',
      '<p>Los datos se guardan en una base de datos Postgres (o en un archivo del servidor si no hay base de datos conectada). Solo usamos una cookie de sesión para mantener tu inicio de sesión: sin rastreo publicitario ni envío de datos a terceros.</p>',
      '<p>"Lo que estás escuchando" solo lo ven los amigos que tienen el compartir activado. Puedes desactivarlo cuando quieras desde Ajustes.</p>',
      '<p>Puedes borrar todos tus datos —me gusta, playlists y conexiones de amigos— desde "Eliminar cuenta" en Ajustes.</p>',
      `<p>¿Dudas? Escríbenos a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    terms: [
      '<p>Swipee es un servicio gratuito creado y operado por un desarrollador individual. No garantizamos un funcionamiento continuo o libre de errores, y las funciones pueden cambiar o dejar de estar disponibles sin previo aviso.</p>',
      '<p>No está permitido acceder sin autorización, interrumpir el servicio, copiar o redistribuir ilegalmente datos de audio protegidos por derechos de autor, ni infringir de ningún otro modo la ley o los términos de los servicios vinculados.</p>',
      '<p>Si conectas Spotify, también debes cumplir los propios Términos del Servicio de Spotify. Los datos de las canciones se obtienen a través de la API pública de Deezer.</p>',
      '<p>El servicio se ofrece "tal cual" y el operador no se hace responsable de los daños derivados de su uso.</p>',
      `<p>Para preguntas sobre estos términos, escribe a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    faq: [
      {q:'¿Puedo usarlo sin cuenta de Spotify?', a:'Sí, con un apodo ya puedes empezar. Descubrir, dar me gusta, la biblioteca y los amigos están abiertos para todos. La conexión con Spotify (crear playlists automáticamente, compartir lo que escuchas en Spotify) está en beta limitada, solo para testers por ahora, a la espera de una revisión para abrirla más.'},
      {q:'¿Cómo se detecta el "estribillo"?', a:'No se analiza el estribillo exacto de la canción. Se reproduce el avance de 30 segundos de Deezer, que suele ser la parte más pegadiza.'},
      {q:'¿Qué pueden ver mis amigos?', a:'Solo el título y el artista de lo que estás escuchando ahora, no tu lista completa de favoritos ni tu historial. Puedes desactivar esto cuando quieras desde Ajustes.'},
      {q:'¿Cómo borro todos mis datos?', a:'Usa "Eliminar cuenta" en Ajustes para borrar todo: me gusta, playlists y conexiones de amigos. Esta acción no se puede deshacer.'},
      {q:'¿Es gratis? ¿Tiene anuncios?', a:'Sí, es gratis y no tiene anuncios.'},
      {q:'¿Dónde reporto un error o envío sugerencias?', a:`Escríbenos a ${CONTACT_EMAIL}.`},
    ],
  },
  fr: {
    privacy: [
      "<p>Swipee traite les informations suivantes : ton pseudo, les informations de ton compte Spotify (y compris les jetons) si tu le connectes, les titres que tu as aimés, les playlists que tu crées, ta liste d'amis, et ce que tu écoutes en ce moment. Ces données servent uniquement à fournir les fonctionnalités de l'app (découverte, bibliothèque, partage avec les amis).</p>",
      "<p>La recherche et les extraits utilisent l'API publique de Deezer ; la création de playlists et la récupération du titre en cours (quand Spotify est connecté) utilisent l'API Web de Spotify. Les conditions et politiques de confidentialité de chaque service s'appliquent également.</p>",
      "<p>Les données sont stockées dans une base Postgres (ou dans un fichier sur le serveur si non connecté). Nous utilisons uniquement un cookie de session pour te garder connecté — aucun traqueur publicitaire, et nous ne partageons pas tes données avec des tiers.</p>",
      "<p>« Ce que tu écoutes » n'est visible que par les amis qui ont activé le partage. Tu peux le désactiver à tout moment dans les réglages.</p>",
      '<p>Tu peux supprimer toutes tes données — titres aimés, playlists et connexions d\'amis — depuis « Supprimer le compte » dans les réglages.</p>',
      `<p>Des questions ? Écris-nous à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    terms: [
      "<p>Swipee est un service gratuit développé et exploité par un développeur indépendant. Nous ne garantissons pas un fonctionnement continu ou sans erreur, et les fonctionnalités peuvent changer ou être interrompues sans préavis.</p>",
      "<p>Il est interdit d'accéder au service sans autorisation, de le perturber, de copier ou redistribuer illégalement des données audio protégées par le droit d'auteur, ou d'enfreindre de toute autre manière la loi applicable ou les conditions des services liés.</p>",
      "<p>Si tu connectes Spotify, tu dois également respecter les propres conditions d'utilisation de Spotify. Les données des titres sont récupérées via l'API publique de Deezer.</p>",
      '<p>Le service est fourni « tel quel », et l\'exploitant n\'est pas responsable des dommages résultant de son utilisation.</p>',
      `<p>Pour toute question concernant ces conditions, contacte <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ].join(''),
    faq: [
      {q:'Puis-je l\'utiliser sans compte Spotify ?', a:"Oui, un pseudo suffit pour commencer. Découvrir, aimer, la bibliothèque et les amis sont ouverts à tous. La connexion Spotify (création automatique de playlists, partage de ce que tu écoutes sur Spotify) est en bêta limitée, réservée aux testeurs pour l'instant, en attente d'une validation pour l'ouvrir davantage."},
      {q:'Comment le « refrain » est-il détecté ?', a:"Nous n'analysons pas le refrain exact du titre. Nous lisons l'extrait de 30 secondes fourni par Deezer, qui correspond généralement au passage le plus marquant."},
      {q:'Que voient mes amis ?', a:"Seulement le titre et l'artiste de ce que tu écoutes en ce moment — pas ta liste complète de favoris ni ton historique. Tu peux désactiver le partage à tout moment dans les réglages."},
      {q:'Comment supprimer toutes mes données ?', a:'Utilise « Supprimer le compte » dans les réglages pour tout effacer — titres aimés, playlists et connexions d\'amis. Cette action est irréversible.'},
      {q:'Est-ce gratuit ? Y a-t-il de la pub ?', a:"Oui, c'est gratuit, et il n'y a pas de publicité."},
      {q:'Où signaler un bug ou envoyer un avis ?', a:`Écris-nous à ${CONTACT_EMAIL}.`},
    ],
  },
};
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
  const tap = $('#tap'); if (tap) tap.textContent = tr('tapToPlay');
  const lb = $('#badgeLike'), sb = $('#badgeSkip'); if (lb) lb.textContent = tr('likeBadge'); if (sb) sb.textContent = tr('skipBadge');
  if (!cur && $('#card')) { const p = $('#card > p.mut'); if (p) p.textContent = tr('noTracksFound') }
  const activeTab = document.querySelector('nav .on')?.dataset.tab;
  if (me && activeTab === 'library') renderLibrary();
  if (me && activeTab === 'friends') renderFriends();
  if (me && activeTab === 'settings') renderSettings();
}

function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); $('#langSel').classList.remove('hidden') }

// ---- ホーム画面に追加の案内 ----
function platformHint() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
function showA2HS() {
  const p = platformHint();
  $('#a2hsSteps').innerHTML = tr(p === 'ios' ? 'a2hsIOS' : p === 'android' ? 'a2hsAndroid' : 'a2hsOther');
  $('#a2hsModal').classList.remove('hidden');
}
$('#a2hsClose').onclick = () => $('#a2hsModal').classList.add('hidden');

async function init() {
  initLangSelector(); applyStaticI18n();
  const cfg = await fetch('/api/config').then(r => r.json());
  genresCfg = cfg.genres; populateGenreSelect();
  if (!cfg.spotify_configured) { $('#spLogin').style.display = 'none'; $('#spBetaNote').style.display = 'none' }
  try { me = await api('/api/me') } catch { return showLogin() }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#langSel').classList.add('hidden');
  loadFeed();
  if (new URLSearchParams(location.search).get('welcome') === '1') { // Spotifyで新規登録した直後
    showA2HS();
    window.history.replaceState(null, '', location.pathname);
  }
}
$('#demoForm').onsubmit = async e => {
  e.preventDefault();
  try { await api('/api/login', {name: $('#name').value}); await init(); showA2HS() } catch (e) { toast(trerr(e.message)) }
};

// ---- 発見 ----
// feedSrc: 候補から選んだ/Enterで確定した検索条件({q}か{artist})。nullなら入力欄とジャンルに従う
let feedSrc = null, shown = new Set(), loadSeq = 0, sugItems = [];
const isSearch = () => !!(feedSrc || $('#q').value.trim());
const feedUrl = () => feedSrc?.artist ? `/api/feed?artist=${feedSrc.artist}` : `/api/feed?genre=${$('#genre').value}&q=${encodeURIComponent(feedSrc?.q ?? $('#q').value.trim())}`;
async function loadFeed(autoplay = false) {
  closeSuggest(); shown = new Set();
  const my = ++loadSeq, list = await api(feedUrl());
  if (my !== loadSeq) return; // 後から始まった検索に追い越された古い結果は捨てる
  queue = list; next(autoplay, autoplay);
}
const syncClear = () => $('#qClear').classList.toggle('hidden', !$('#q').value);
$('#genre').onchange = () => { $('#q').value = ''; syncClear(); feedSrc = null; loadFeed() };
$('#qClear').onmousedown = e => e.preventDefault(); // 入力欄からフォーカスを奪わない(キーボードを出したまま打ち直せる)
$('#qClear').onclick = () => { $('#q').value = ''; $('#q').dispatchEvent(new Event('input')); $('#q').focus() };

// ---- 検索: 候補(アーティスト+曲)の選択・Enter確定 ----
let suggestTimer = null;
function closeSuggest() { const b = $('#suggest'); b.classList.add('hidden'); b.innerHTML = ''; sugItems = [] }
function pickTrack(t) { // 選んだ曲そのものを、タップ操作の中で同期的に再生する(続きの候補は後から追加される)
  closeSuggest(); $('#q').value = t.title; syncClear(); $('#q').blur();
  feedSrc = t.artist_id ? {artist: t.artist_id} : {q: `${t.artist} ${t.title}`}; shown = new Set(); ++loadSeq; // 続きは同じアーティストの人気曲(カバー/カラオケを避ける)
  queue = [t]; next(true, true);
}
function pickArtist(a) { closeSuggest(); $('#q').value = a.name; syncClear(); $('#q').blur(); feedSrc = {artist: a.id}; loadFeed(true) }
function searchNow() { // Enter: 入力した語で検索し、先頭の曲を再生
  clearTimeout(suggestTimer); const v = $('#q').value.trim(); $('#q').blur();
  feedSrc = v ? {q: v} : null; loadFeed(!!v);
}
$('#q').addEventListener('input', () => {
  clearTimeout(suggestTimer); syncClear();
  const v = $('#q').value.trim();
  if (!v) { closeSuggest(); if (feedSrc) { feedSrc = null; loadFeed() } return } // 入力を消したらジャンルのフィードに戻す
  if (v.length < (/[^\x00-\x7F]/.test(v) ? 1 : 2)) { closeSuggest(); return }
  suggestTimer = setTimeout(async () => {
    let items; try { items = await api('/api/suggest?q=' + encodeURIComponent(v)) } catch { return }
    if ($('#q').value.trim() !== v) return; // 入力が変わっていたら古い結果は捨てる
    if (!items.length) return closeSuggest();
    sugItems = items; const box = $('#suggest');
    box.innerHTML = items.map((it, i) => it.kind === 'artist'
      ? `<button type=button data-i=${i}><img class=ava src="${esc(it.picture)}"><div><b>${esc(it.name)}</b><small>${tr('artistLabel')}</small></div></button>`
      : `<button type=button data-i=${i}><img src="${esc(it.cover)}"><div><b>${esc(it.title)}</b><small>${esc(it.artist)}</small></div></button>`).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('button').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const it = sugItems[+b.dataset.i]; if (it) it.kind === 'artist' ? pickArtist(it) : pickTrack(it) } });
  }, 200);
});
document.addEventListener('click', e => { if (!e.target.closest('.searchwrap')) closeSuggest() });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') searchNow() });
function next(autoplay = true, force = false) { // force: ユーザーが曲を明示的に選んだ時は「自動再生しない」設定でも再生する
  autoplay = autoplay && (force || getPref('autoplayCards', true));
  swiping = false; likedPending = false;
  const likeBtn = $('#like'); likeBtn.classList.remove('pending'); likeBtn.textContent = '♥';
  const card = $('#card');
  card.style.transition = 'none'; card.style.transform = ''; card.style.opacity = ''; // 飛んでいった前のカードの見た目を新しいカードへ引き継がせない
  if (!queue.length) { card.innerHTML = `<p class=mut style="margin-top:160px">${tr('noTracksFound')}</p>`; void card.offsetHeight; card.style.transition = ''; audio.pause(); cur = null; return loadMore() }
  cur = queue.shift(); reported = false; shown.add(cur.id);
  card.innerHTML = `<div class="badge like" id="badgeLike">${tr('likeBadge')}</div><div class="badge skip" id="badgeSkip">${tr('skipBadge')}</div><img src="${esc(cur.cover)}"><h2>${esc(cur.title)}</h2><div class=ar>${esc(cur.artist)}</div><div class=seek id=seek><div class=bar><i id=prog></i></div></div><div class=times><span id=tcur>0:00</span><span id=tdur>0:30</span></div>${autoplay ? '' : `<div class=tap id=tap>${tr('tapToPlay')}</div>`}`;
  void card.offsetHeight; card.style.transition = ''; // reflowを挟んでから transition を戻し、リセット自体はアニメーションさせない
  wireSeek();
  const tap = $('#tap'); if (tap) tap.onclick = () => { tap.remove(); play() };
  audio.src = cur.preview; paintTime();
  if (autoplay) { const mine = cur; audio.play().catch(() => { if (cur === mine && !$('#tap')) { card.insertAdjacentHTML('beforeend', `<div class=tap id=tap>${tr('tapToPlay')}</div>`); $('#tap').onclick = () => { $('#tap').remove(); play() } } }) } // 自動再生をブラウザに止められたらタップで再生
  if (queue.length < 5) loadMore();
}
let loading = false; async function loadMore() { if (loading) return; loading = true; const my = loadSeq; try { const more = await api(feedUrl()); if (my !== loadSeq) return; const ids = new Set(queue.map(t => t.id)), search = isSearch(); queue.push(...more.filter(t => !ids.has(t.id) && t.id !== cur?.id && !(search && shown.has(t.id)))); if (!cur) next() } finally { loading = false } }
const play = () => audio.play().catch(() => {});
// ---- 再生位置バー(タップ/ドラッグでシーク) ----
let seeking = false;
const fmt = sec => { sec = Math.max(0, Math.floor(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') };
function paintTime() {
  const d = audio.duration, p = $('#prog'), tc = $('#tcur'), td = $('#tdur');
  if (p) p.style.width = (d ? audio.currentTime / d * 100 : 0) + '%';
  if (tc) tc.textContent = fmt(audio.currentTime);
  if (td) td.textContent = fmt(d || 30);
  if (d && isFinite(d) && 'mediaSession' in navigator) { try { navigator.mediaSession.setPositionState({duration: d, position: Math.min(audio.currentTime, d), playbackRate: audio.playbackRate || 1}) } catch {} }
}
function wireSeek() {
  const el = $('#seek'); if (!el) return;
  const set = e => { const r = el.getBoundingClientRect(); if (audio.duration) { audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration; paintTime() } };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.button > 0) return; seeking = true; el.classList.add('active'); try { el.setPointerCapture(e.pointerId) } catch {} set(e) }); // stopPropagation: カードのスワイプ判定に拾わせない
  el.addEventListener('pointermove', e => { if (seeking) set(e) });
  const end = () => { seeking = false; el.classList.remove('active') };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
audio.addEventListener('loadedmetadata', paintTime);
audio.ontimeupdate = () => { if (!seeking) paintTime();
  if (!reported && audio.currentTime > 5 && cur) { reported = true; api('/api/nowplaying', {track: cur}).catch(() => {}) } };
audio.onended = () => play();
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
audio.addEventListener('play', () => { $('#pause').innerHTML = ICON_PAUSE });
audio.addEventListener('pause', () => { $('#pause').innerHTML = ICON_PLAY });
$('#pause').onclick = () => { audio.paused ? play() : audio.pause() };
async function like() { if (!cur) return; await api('/api/like', {track: cur}); if (!me.likes.some(t => t.id === cur.id)) me.likes.push(cur); toast(tr('likedAdded')); next() }

// ---- スワイプ(指に追従して傾き、フリックでカードが飛んでいく) ----
let swiping = false, history = [], likedPending = false;
function commitSwipe(dir) {
  if (!cur || swiping) return;
  swiping = true;
  haptic(dir > 0 ? 20 : 12);
  const alreadyLiked = dir > 0 && likedPending; // ♥を1回タップ済みで確定待ちの状態からの2回目
  if (!alreadyLiked) { history.push(cur); if (history.length > 30) history.shift(); }
  const card = $('#card');
  card.style.transition = 'transform .3s ease, opacity .3s ease';
  card.style.transform = `translate(${dir * (innerWidth * 0.9 + 120)}px, -30px) rotate(${dir * 24}deg)`;
  card.style.opacity = '0';
  setTimeout(() => { (dir > 0 && !alreadyLiked) ? like() : next() }, 260);
}
// ---- ♥タップ: 1回目はいいねだけ登録して留まる、2回目で次のカードへ ----
function tapLike() {
  if (!cur || swiping) return;
  if (likedPending) { commitSwipe(1); return }
  haptic(20);
  likedPending = true;
  history.push(cur); if (history.length > 30) history.shift();
  api('/api/like', {track: cur}).then(() => { if (!me.likes.some(t => t.id === cur.id)) me.likes.push(cur) }).catch(() => {});
  const lb = $('#badgeLike'); if (lb) lb.style.opacity = 1;
  const likeBtn = $('#like'); likeBtn.classList.add('pending'); likeBtn.textContent = '→';
  toast(tr('likedAdded'));
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
$('#like').onclick = tapLike; $('#skip').onclick = () => commitSwipe(-1); $('#replay').onclick = () => { audio.currentTime = 0; play() };
document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') tapLike(); if (e.key === 'ArrowLeft') commitSwipe(-1); if (e.key === ' ') { e.preventDefault(); audio.paused ? play() : audio.pause() } if (e.key === 'z' || e.key === 'Z') undoSwipe(); });

// ---- タブ ----
document.querySelectorAll('nav button').forEach(b => b.onclick = async () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + b.dataset.tab));
  $('main').scrollTop = 0; // 前のタブのスクロール位置が新タブに残って表示がずれるのを防ぐ
  if (b.dataset.tab === 'discover') { if (cur && audio.src !== cur.preview) { audio.src = cur.preview; play() } }
  else audio.pause();
  if (b.dataset.tab === 'library') { me = await api('/api/me'); renderLibrary() }
  if (b.dataset.tab === 'friends') renderFriends()
  if (b.dataset.tab === 'settings') { me = await api('/api/me'); renderSettings() }
});
const row = (t, extra = '', pin = false) => `<div class=row><img src="${esc(t.cover)}"><div class=t><b>${pin ? PIN_BADGE : ''}${esc(t.title)}</b><small>${esc(t.artist)}</small></div>${extra}</div>`;

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
const ICON_PIN_FILL = '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M12 2a5 5 0 0 1 5 5c0 3.5-5 10-5 10s-5-6.5-5-10a5 5 0 0 1 5-5zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>';
const PIN_BADGE = `<span class=pinbadge>${ICON_PIN_FILL}</span>`;
const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 3.5-5 10-5 10s-5-6.5-5-10a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="2"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>';
const swipeRow = (inner, id, pinned) => `<div class="swiperow" data-id="${id}"><button class="swipe-action swipe-pin${pinned ? ' active' : ''}" title="${esc(pinned ? tr('unpinBtn') : tr('pinBtn'))}">${pinned ? ICON_PIN_FILL : ICON_PIN}</button>${inner}<button class="swipe-action swipe-del" title="${esc(tr('deleteBtn'))}">${ICON_TRASH}</button></div>`;

const CHEV = closed => `<svg class="chev${closed ? ' closed' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
let libCollapse = {likes: false, playlists: false};
let plExpanded = {};
function renderLibrary() {
  openSwipeRow = null;
  const el = $('#tab-library');
  const likesSorted = me.likes.slice().reverse().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const plsSorted = me.playlists.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const allSel = me.likes.length > 0 && me.likes.every(t => selected.has(t.id));
  el.innerHTML = `<h3>${tr('libCreateTitle')}</h3>
    <div class=bx><input id=plName placeholder="${tr('plNamePh')}" value="${esc(tr('plDefaultPrefix'))} ${new Date().toLocaleDateString(LOCALE_TAG[lang])}"></div>
    <label class=mut><input type=checkbox id=mix checked> ${tr('mixLabel')}</label><br>
    <label class=mut><input type=checkbox id=plPublic> ${tr('publicLabel')}</label>
    <div class=bx><button class="btn green" id=mk>${me.spotify ? tr('mkBtnSpotify') : tr('mkBtnLocal')}</button><button class="btn sm" id=all>${tr(allSel ? 'deselectAllBtn' : 'selectAllBtn')}</button>${me.likes.length ? `<button class="btn sm danger" id=delSel>${tr('deleteSelectedBtn')}</button>` : ''}</div>
    ${me.spotify ? '' : `<p class=hint style="text-align:left">${tr('notLinkedHint')} <a href="/auth/login">${tr('spotifyLinkText')}</a></p>`}
    <h3 class="collapsible" data-collapse="likes">${tr('likedTitle', {n: me.likes.length})}${CHEV(libCollapse.likes)}</h3>
    <div class="collapseBody${libCollapse.likes ? ' hidden' : ''}">${likesSorted.length ? likesSorted.map(t => swipeRow(row(t, `<button class="btn sm" data-play=${t.id}>${tr('playSabiBtn')}</button><input type=checkbox data-id=${t.id} ${selected.has(t.id) ? 'checked' : ''}>`, t.pinned), t.id, t.pinned)).join('') : `<p class=mut>${tr('likedEmpty')}</p>`}</div>
    <h3 class="collapsible" data-collapse="playlists">${tr('playlistsTitle')}${CHEV(libCollapse.playlists)}</h3>
    <div class="collapseBody${libCollapse.playlists ? ' hidden' : ''}">${plsSorted.map(p => swipeRow(`<div class=row><div class=t><b>${p.pinned ? PIN_BADGE : ''}${esc(p.name)}</b><small>${tr('trackCount', {n: p.tracks.length})}${p.spotify_url ? tr('matchedSuffix', {n: p.matched}) : ''}</small>${p.error ? `<small style="color:#f66">${esc(trerr(p.error))}</small>` : ''}</div><label class="plVis" title="${esc(tr('publicLabel'))}"><input type=checkbox class=toggle data-vis=${p.id} ${p.public ? 'checked' : ''}></label><button class="btn sm" data-viewpl=${p.id}>${CHEV(!plExpanded[p.id])}</button>${p.spotify_url ? `<a class="btn sm" target=_blank href="${esc(p.spotify_url)}">${tr('openBtn')}</a>` : ''}</div>`, p.id, p.pinned) + (plExpanded[p.id] ? `<div class=plTracks>${p.tracks.map((t, i) => row(t, `<button class="btn sm" data-plplay="${p.id}:${i}">${tr('playSabiBtn')}</button>`)).join('')}</div>` : '')).join('') || `<p class=mut>${tr('playlistsEmpty')}</p>`}</div>`;
  el.querySelectorAll('.collapsible').forEach(h => h.onclick = () => { libCollapse[h.dataset.collapse] = !libCollapse[h.dataset.collapse]; renderLibrary() });
  el.querySelectorAll('[data-play]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const t = await api('/api/preview?id=' + b.dataset.play);
    audio.src = t.preview; play();
    toast(tr('nowPreviewToast', {title: t.title}));
  });
  el.querySelectorAll('[data-viewpl]').forEach(b => b.onclick = e => { e.stopPropagation(); plExpanded[b.dataset.viewpl] = !plExpanded[b.dataset.viewpl]; renderLibrary() });
  el.querySelectorAll('[data-vis]').forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = async e => {
    const id = c.dataset.vis, pub = e.target.checked;
    try { await api('/api/playlist/visibility', {id, public: pub}); const p = me.playlists.find(x => x.id === id); if (p) p.public = pub; toast(pub ? tr('madePublicToast') : tr('madePrivateToast')) } catch (err) { toast(trerr(err.message)); e.target.checked = !pub }
  } });
  el.querySelectorAll('[data-plplay]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const [pid, idx] = b.dataset.plplay.split(':');
    const t = me.playlists.find(p => p.id === pid)?.tracks[+idx]; if (!t) return;
    audio.src = t.preview; play();
    toast(tr('nowPreviewToast', {title: t.title}));
  });
  el.querySelectorAll('[data-id]').forEach(c => { if (c.matches('input[type=checkbox]')) c.onchange = () => { c.checked ? selected.add(+c.dataset.id) : selected.delete(+c.dataset.id); $('#all').textContent = tr(me.likes.every(t => selected.has(t.id)) ? 'deselectAllBtn' : 'selectAllBtn') } });
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
  $('#all').onclick = () => {
    const allSelected = me.likes.length > 0 && me.likes.every(t => selected.has(t.id));
    if (allSelected) selected.clear(); else me.likes.forEach(t => selected.add(t.id));
    renderLibrary();
  };
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
    try { const p = await api('/api/playlist', {name: $('#plName').value, tracks: tr2, mix: $('#mix').checked, public: $('#plPublic').checked, size: 30, desc: tr('plDesc')}); toast(p.spotify_url ? tr('createdSpotify') : tr('createdLocal')); selected.clear() } catch (e) { toast(trerr(e.message)) }
    me = await api('/api/me'); renderLibrary();
  };
}

let friendTimer;
async function renderFriends() {
  clearInterval(friendTimer);
  const draw = async () => {
    if ($('#tab-friends').classList.contains('hidden')) return clearInterval(friendTimer);
    const fs = await api('/api/friends'), el = $('#tab-friends'), keep = $('#code')?.value || '';
    const friendPls = fs.flatMap(f => (f.playlists || []).map(p => ({...p, ownerName: f.name, key: `f:${f.id}:${p.id}`})));
    el.innerHTML = `<h3>${tr('inviteCodeTitle')}</h3><div class=row><b style="font-size:1.5rem;letter-spacing:.15em;flex:1">${me.code}</b><button class="btn sm" id=copy>${tr('copyBtn')}</button></div>
      <div class=bx><input id=code placeholder="${tr('friendCodePh')}" value="${esc(keep)}"><button class="btn" id=add>${tr('addBtn')}</button></div>
      <h3>${tr('nowPlayingTitle')}</h3>
      ${fs.map(f => f.now ? row(f.now.track, `<div style="text-align:right"><div class=live>● ${f.now.source === 'spotify' ? tr('sourceSpotify') : tr('sourceApp')}</div><small>${esc(f.name)}</small>${f.now.track.id ? `<br><button class="btn sm" data-pv=${f.now.track.id}>${tr('playSabiBtn')}</button> <button class="btn sm" data-lk=${f.now.track.id}>♥</button>` : ''}</div>`)
        : `<div class=row><div class=t><b>${esc(f.name)}</b><small>${tr('notPlaying')}</small></div></div>`).join('') || `<p class=mut>${tr('friendsEmpty')}</p>`}
      <h3>${tr('friendPlaylistsTitle')}</h3>
      ${friendPls.length ? friendPls.map(p => `<div class=row><div class=t><b>${esc(p.name)}</b><small>${tr('trackCount', {n: p.tracks.length})} · ${esc(p.ownerName)}</small></div><button class="btn sm" data-fviewpl="${p.key}">${CHEV(!plExpanded[p.key])}</button>${p.spotify_url ? `<a class="btn sm" target=_blank href="${esc(p.spotify_url)}">${tr('openBtn')}</a>` : ''}</div>${plExpanded[p.key] ? `<div class=plTracks>${p.tracks.map((t, i) => row(t, `<button class="btn sm" data-fplplay="${p.key}|${i}">${tr('playSabiBtn')}</button>`)).join('')}</div>` : ''}`).join('') : `<p class=mut>${tr('playlistsEmpty')}</p>`}`;
    $('#copy').onclick = () => { navigator.clipboard?.writeText(me.code); toast(tr('copied')) };
    $('#add').onclick = async () => { try { const r = await api('/api/friends/add', {code: $('#code').value}); toast(tr('friendAdded', {name: r.name})); draw() } catch (e) { toast(trerr(e.message)) } };
    el.querySelectorAll('[data-pv]').forEach(b => b.onclick = async () => { const t = await api('/api/preview?id=' + b.dataset.pv); audio.src = t.preview; play(); toast(tr('nowPreviewToast', {title: t.title})) });
    el.querySelectorAll('[data-lk]').forEach(b => b.onclick = async () => { const t = await api('/api/preview?id=' + b.dataset.lk); await api('/api/like', {track: t}); toast(tr('likedAdded')) });
    el.querySelectorAll('[data-fviewpl]').forEach(b => b.onclick = () => { plExpanded[b.dataset.fviewpl] = !plExpanded[b.dataset.fviewpl]; draw() });
    el.querySelectorAll('[data-fplplay]').forEach(b => b.onclick = () => {
      const [key, idx] = b.dataset.fplplay.split('|');
      const t = friendPls.find(p => p.key === key)?.tracks[+idx]; if (!t) return;
      audio.src = t.preview; play();
      toast(tr('nowPreviewToast', {title: t.title}));
    });
  };
  await draw(); friendTimer = setInterval(() => { if (document.activeElement?.id !== 'code') draw() }, 10000);
}

function renderSettings() {
  const el = $('#tab-settings');
  el.innerHTML = `<h3>${tr('settingsTitle')}</h3>
    <div class=bx><label class=mut style="flex:1">${tr('languageLabel')}<br><select id=setLang style="margin-top:6px;width:100%"></select></label></div>
    <div class=bx><label class=mut style="flex:1">${tr('themeLabel')}<br><select id=setTheme style="margin-top:6px;width:100%">
      <option value="system">${tr('themeSystem')}</option>
      <option value="light">${tr('themeLight')}</option>
      <option value="dark">${tr('themeDark')}</option>
    </select></label></div>
    <div class=bx><input id=setName maxlength=20 value="${esc(me.name)}" placeholder="${tr('nicknameLabel')}"><button class="btn" id=setNameSave>${tr('saveBtn')}</button></div>
    <div class=settingsGroup>
      <label class=settingsRow><span>${tr('shareLabel')}</span><input type=checkbox class=toggle id=setShare ${me.share ? 'checked' : ''}></label>
    </div>
    <h3>${tr('playbackSettingsTitle')}</h3>
    <div class=settingsGroup>
      <label class=settingsRow><span>${tr('bgPlaybackLabel')}</span><input type=checkbox class=toggle id=setBgPlayback ${getPref('bgPlayback', true) ? 'checked' : ''}></label>
      <label class=settingsRow><span>${tr('autoplayCardsLabel')}</span><input type=checkbox class=toggle id=setAutoplayCards ${getPref('autoplayCards', true) ? 'checked' : ''}></label>
      <label class=settingsRow><span>${tr('hapticsLabel')}</span><input type=checkbox class=toggle id=setHaptics ${getPref('haptics', true) ? 'checked' : ''}></label>
      <label class=settingsRow><span>${tr('reduceMotionLabel')}</span><input type=checkbox class=toggle id=setReduceMotion ${getPref('reduceMotion', false) ? 'checked' : ''}></label>
    </div>
    <h3>${tr('spotifyLabel')}</h3>
    <div class=row><div class=t><b>${me.spotify ? tr('spotifyConnected') : tr('spotifyNotConnected')}</b></div>${me.spotify ? `<button class="btn sm danger" id=spUnlink>${tr('unlinkBtn')}</button>` : `<a class="btn sm green" href="/auth/login">${tr('spotifyLinkText')}</a>`}</div>
    ${me.spotify ? '' : `<p class="betaNote" style="text-align:left">${tr('spotifyBetaNote')}</p>`}
    <div class=bx><button class="btn" id=logout>${tr('logoutBtn')}</button></div>
    <h3>${tr('supportTitle')}</h3>
    <div class=bx>
      <button class="btn sm" id=goA2hs>${tr('a2hsSettingsBtn')}</button>
      <button class="btn sm" id=goPrivacy>${tr('privacyTitle')}</button>
      <button class="btn sm" id=goTerms>${tr('termsTitle')}</button>
      <button class="btn sm" id=goFaq>${tr('faqTitle')}</button>
      <button class="btn sm" id=goFeedback>${tr('feedbackBtn')}</button>
      <button class="btn sm" id=goContact>${tr('contactTitle')}</button>
    </div>
    <div class=bx style="margin-top:22px"><button class="btn danger" id=delAcct>${tr('deleteAccountBtn')}</button></div>`;
  const setLangSel = $('#setLang');
  setLangSel.innerHTML = SUPPORTED.map(c => `<option value="${c}">${LANGS[c].langName}</option>`).join('');
  setLangSel.value = lang;
  setLangSel.onchange = () => { setLang(setLangSel.value); $('#langSel').value = lang; renderSettings() };
  const setThemeSel = $('#setTheme');
  setThemeSel.value = getTheme();
  setThemeSel.onchange = () => setTheme(setThemeSel.value);
  $('#setBgPlayback').onchange = e => setPref('bgPlayback', e.target.checked);
  $('#setAutoplayCards').onchange = e => setPref('autoplayCards', e.target.checked);
  $('#setHaptics').onchange = e => setPref('haptics', e.target.checked);
  $('#setReduceMotion').onchange = e => { setPref('reduceMotion', e.target.checked); applyReduceMotion() };
  $('#setNameSave').onclick = async () => {
    const v = $('#setName').value.trim(); if (!v) return toast(trerr('name_required'));
    try { await api('/api/profile', {name: v}); me = await api('/api/me'); toast(tr('savedToast')) } catch (e) { toast(trerr(e.message)) }
  };
  $('#setShare').onchange = e => api('/api/share', {share: e.target.checked}).then(() => me.share = e.target.checked);
  const spUnlink = $('#spUnlink');
  if (spUnlink) spUnlink.onclick = async () => { await api('/api/spotify/unlink'); me = await api('/api/me'); renderSettings() };
  $('#logout').onclick = async () => { await api('/api/logout'); location.reload() };
  $('#goA2hs').onclick = showA2HS;
  $('#goPrivacy').onclick = () => renderLegal('privacy');
  $('#goTerms').onclick = () => renderLegal('terms');
  $('#goFaq').onclick = () => renderLegal('faq');
  $('#goFeedback').onclick = renderFeedback;
  $('#goContact').onclick = () => renderLegal('contact');
  $('#delAcct').onclick = async () => {
    if (!confirm(tr('confirmDeleteAccount'))) return;
    await api('/api/account/delete');
    location.reload();
  };
}

function renderFeedback() {
  const el = $('#tab-settings');
  el.innerHTML = `<button class="btn sm" id=legalBack>${tr('backBtn')}</button><h3>${tr('feedbackTitle')}</h3>
    <p class=mut>${tr('feedbackIntro')}</p>
    <div class=bx><select id=fbCat style="width:100%"><option value=idea>${tr('fbCatIdea')}</option><option value=bug>${tr('fbCatBug')}</option><option value=other>${tr('fbCatOther')}</option></select></div>
    <div class=bx><textarea id=fbMsg maxlength=2000 rows=6 placeholder="${esc(tr('fbMsgPh'))}"></textarea></div>
    <div class=bx><input id=fbContact type=email maxlength=200 placeholder="${esc(tr('fbContactPh'))}"></div>
    <div class=bx><button class="btn green" id=fbSend>${tr('fbSend')}</button></div>
    <p class=hint style="text-align:left">${tr('fbNote')}</p>`;
  $('#legalBack').onclick = () => renderSettings();
  $('#fbSend').onclick = async () => {
    const message = $('#fbMsg').value.trim(); if (message.length < 3) return toast(trerr('message_required'));
    $('#fbSend').disabled = true;
    try { await api('/api/feedback', {category: $('#fbCat').value, message, contact: $('#fbContact').value.trim(), lang}); toast(tr('fbSent')); renderSettings() }
    catch (e) { toast(trerr(e.message)); $('#fbSend').disabled = false }
  };
}

function renderLegal(kind) {
  const el = $('#tab-settings');
  const titleKey = {privacy: 'privacyTitle', terms: 'termsTitle', faq: 'faqTitle', contact: 'contactTitle'}[kind];
  let body;
  if (kind === 'faq') {
    const items = (LEGAL[lang] || LEGAL.ja).faq;
    body = items.map(qa => `<div class=faq-item><b>${esc(qa.q)}</b><small>${esc(qa.a)}</small></div>`).join('');
  } else if (kind === 'contact') {
    body = `<p>${tr('contactBody')}</p><p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`;
  } else {
    body = `<div class=legal-body>${(LEGAL[lang] || LEGAL.ja)[kind]}</div>`;
  }
  el.innerHTML = `<button class="btn sm" id=legalBack>${tr('backBtn')}</button><h3>${tr(titleKey)}</h3>${body}`;
  $('#legalBack').onclick = () => renderSettings();
}
init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
function setMedia() { if (!('mediaSession' in navigator) || !cur) return;
  navigator.mediaSession.metadata = new MediaMetadata({title: cur.title, artist: cur.artist, artwork: [{src: cur.cover, sizes: '250x250'}]});
  navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', () => { audio.currentTime = 0; play() });
  navigator.mediaSession.setActionHandler('play', play); navigator.mediaSession.setActionHandler('pause', () => audio.pause()); try { navigator.mediaSession.setActionHandler('seekto', d => { audio.currentTime = d.seekTime; paintTime() }) } catch {} }
audio.addEventListener('play', setMedia);
