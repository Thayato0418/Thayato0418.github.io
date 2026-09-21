(() => {
  'use strict';
  const output = document.getElementById('console-output');
  const input = document.getElementById('command-input');
  const history = [];
  let historyIndex = 0;
  const files = {
    'about.txt': 'h_Takara / Security Engineer & CTF Player\nWebセキュリティ、CTF、Bug Bountyを探究。\n調べる → 試す → writeupに残す。これが日々のループ。',
    '.hint': '隠れているものを見る。これが最初の一歩。\n次は cat .flag を実行してみよう。',
    '.flag': 'flag{stay_curious}\n\n発見！ この文字列をチャレンジの入力欄へ。',
    'notes.txt': '学びは、記録すると次の探索の道具になる。\n「blog」で最新の記事へ移動できます。'
  };
  const sections = { about: 'about', blog: 'blog', focus: 'works', links: 'links', contact: 'contact' };
  function line(text, kind = '') {
    const p = document.createElement('p');
    p.textContent = text;
    if (kind) p.className = kind;
    output.append(p);
    while (output.children.length > 60) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  }
  function run(raw) {
    const command = raw.trim();
    if (!command) return;
    history.push(command);
    historyIndex = history.length;
    line(`guest ❯ ${command}`, 'console-command');
    const [name, ...args] = command.split(/\s+/);
    if (name === 'clear') { output.replaceChildren(); }
    else if (name === 'help') line('help       コマンド一覧\nwhoami     プロフィール\nls [-a]    ラボのファイル一覧\ncat FILE   ファイルを読む\nabout / blog / focus / links / contact\n           各セクションへ移動\nclear      表示をクリア\n↑ / ↓      コマンド履歴');
    else if (name === 'whoami') line(files['about.txt']);
    else if (name === 'ls') line(args.includes('-a') ? 'about.txt  notes.txt  .hint  .flag' : 'about.txt  notes.txt\nヒント: 隠しファイルも探してみよう。');
    else if (name === 'cat') line(Object.hasOwn(files, args.join(' ')) ? files[args.join(' ')] : 'ファイルが見つかりません。ls -a で一覧を確認できます。');
    else if (Object.hasOwn(sections, name)) {
      const section = document.getElementById(sections[name]);
      line(`${name} を開きます。`);
      section.tabIndex = -1;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    } else line(`「${name}」は使えません。help でコマンドを確認できます。`);
    input.value = '';
  }
  document.getElementById('command-form').addEventListener('submit', event => { event.preventDefault(); run(input.value); });
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => run(button.dataset.command)));
  input.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
    input.value = history[historyIndex] || '';
  });
  document.getElementById('hint-button').addEventListener('click', event => {
    const hint = document.getElementById('challenge-hint');
    hint.hidden = !hint.hidden;
    event.currentTarget.textContent = hint.hidden ? 'ヒントを見る ＋' : 'ヒントを閉じる −';
    event.currentTarget.setAttribute('aria-expanded', String(!hint.hidden));
  });
  document.getElementById('flag-form').addEventListener('submit', event => {
    event.preventDefault();
    const success = document.getElementById('flag-input').value.trim() === 'flag{stay_curious}';
    const result = document.getElementById('flag-result');
    result.textContent = success ? '✓ CAPTURED! 好奇心こそ、最強のツール。' : 'まだ違うようです。cat .flag の結果を確認してみよう。';
    document.querySelector('.challenge').classList.toggle('solved', success);
    if (success) line('⚑ CHALLENGE SOLVED — Welcome to the curious side.', 'console-success');
  });
  let count = 0;
  const messages = ['まずは観察。見えているものを疑ってみる。', '仮説を立てる。「なぜ？」を手放さない。', '手を動かす。小さく試して、確かめる。', '発見を残す。次の誰かのヒントになる。'];
  document.getElementById('core-button').addEventListener('click', () => {
    document.getElementById('engine-status').textContent = messages[count % messages.length];
    count++;
    document.getElementById('engine-count').textContent = String(count).padStart(2, '0');
    document.querySelector('.lab-visual').style.setProperty('--turn', `${count * 45}deg`);
  });
})();
