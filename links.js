// Enhance the native disclosures into vertical tabs; without JS the links remain usable.
(() => {
  const root = document.querySelector('#links .link-sections');
  if (!root) return;
  const groups = [...root.querySelectorAll('details')];
  const navigation = document.createElement('div');
  navigation.className = 'link-tabs';
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'リンクのカテゴリ');
  navigation.setAttribute('aria-orientation', 'vertical');
  const content = document.createElement('div');
  content.className = 'link-panels';
  const tabs = [];
  const panels = [];
  const select = index => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  };
  groups.forEach((group, index) => {
    const summary = group.querySelector('summary');
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'link-tab';
    tab.id = `link-tab-${index}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `link-panel-${index}`);
    tab.append(...summary.childNodes);
    tab.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    const panel = document.createElement('div');
    panel.className = 'link-panel';
    panel.id = `link-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    const heading = document.createElement('h3');
    heading.textContent = tab.querySelector('.summary-title').textContent;
    panel.append(heading, group.querySelector('.link-grid'));
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % groups.length;
      if (event.key === 'ArrowUp') next = (index - 1 + groups.length) % groups.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = groups.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
    tabs.push(tab);
    panels.push(panel);
    navigation.append(tab);
    content.append(panel);
  });
  select(0);
  root.replaceChildren(navigation, content);
  root.classList.add('links-browser');
})();
