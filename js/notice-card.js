// notice-card.js
(function() {
  'use strict';

  const CONFIG = {
    enabled: true,
    title: '通知',
    content: '可恶的外星人要招高中牲去对抗其他地外文明, 暂时没有时间管理这个小站了💢😇。<br>感谢您的理解与支持辣！',
    buttons: [
      { text: '查看挖坑计划', link: '/goals/', target: '_self' },
      { text: '来多邻国打个卡', link: 'https://www.duolingo.com/', target: '_blank' }
    ],
    closeText: '朕已阅',
    storageKey: 'site_notice_closed',
    permanentHide: false,  // true=关闭后永久隐藏, false=每次刷新都显示
    delay: 700
  };

  function isClosed() {
    if (!CONFIG.permanentHide) return false;
    try { return localStorage.getItem(CONFIG.storageKey) === 'true'; } catch { return false; }
  }
  function setClosed() {
    if (!CONFIG.permanentHide) return;
    try { localStorage.setItem(CONFIG.storageKey, 'true'); } catch {}
  }

  function createNoticeCard() {
    if (isClosed() || !CONFIG.enabled) return;
    if (document.getElementById('noticeOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'notice-overlay';
    overlay.id = 'noticeOverlay';

    const card = document.createElement('div');
    card.className = 'notice-card';

    const title = document.createElement('div');
    title.className = 'notice-title';
    title.textContent = CONFIG.title;

    const content = document.createElement('div');
    content.className = 'notice-content';
    content.innerHTML = CONFIG.content;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'notice-buttons';

    CONFIG.buttons.forEach((btn, index) => {
      const a = document.createElement('a');
      a.className = 'notice-btn' + (index === 1 ? ' notice-btn-outline' : '');
      a.textContent = btn.text;
      a.href = btn.link;
      a.target = btn.target || '_self';
      if (btn.target === '_blank') a.rel = 'noopener noreferrer';

      a.addEventListener('click', function(e) {
        if (btn.target === '_blank') {
          closeNotice();
        } else {
          e.preventDefault();
          closeNotice();
          window.location.href = btn.link;
        }
      });
      btnContainer.appendChild(a);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notice-close-btn';
    closeBtn.textContent = CONFIG.closeText || '关闭';
    closeBtn.addEventListener('click', closeNotice);

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(btnContainer);
    card.appendChild(closeBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      card.classList.add('active');
    });
  }

  function closeNotice() {
    const overlay = document.getElementById('noticeOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 400);
    }
    setClosed();
  }

  function init() {
    if (!CONFIG.enabled) return;
    setTimeout(createNoticeCard, CONFIG.delay || 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();