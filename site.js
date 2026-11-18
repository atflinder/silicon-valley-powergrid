/* Keep website behavior private to this file and wait for deferred data/chart scripts. */
{
  // Reuse the same embedded complete-day observations as the checked scatterplot.
  const observations = JSON.parse(document.getElementById('demand-data').textContent);
  const year = document.getElementById('demand-year');
  const season = document.getElementById('demand-season');
  const dayType = document.getElementById('demand-type');
  // Use one handler for guided calendar selections and resetting the chart.
  for (const button of document.querySelectorAll('#demand-reset, #demand-fall')) {
    button.addEventListener('click', () => {
      // September belongs to meteorological fall, including the selected hot spell.
      year.value = button.id === 'demand-fall' ? '2022' : 'All';
      season.value = button.id === 'demand-fall' ? 'Fall' : 'All';
      dayType.value = 'All';
      // A single native change event reads the current values of all three filters.
      year.dispatchEvent(new Event('change', {bubbles:true}));
    });
  }
  // Download only the visible scientific sample, using the same three restrictions.
  document.getElementById('download-daily').addEventListener('click', () => {
    const selected = observations.filter(day =>
      (year.value === 'All' || String(day.year) === year.value) &&
      (season.value === 'All' || day.season === season.value) &&
      (dayType.value === 'All' || day.day_type === dayType.value));
    const columns = ['date','year','season','day_type','temperature_f','daily_gwh'];
    // Source fields contain only checked dates, category names, and numeric values.
    const csv = [columns.join(','), ...selected.map(day => columns.map(key => day[key]).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `caiso_weather_${year.value}_${season.value}_${dayType.value}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    // Release the temporary browser object after the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Size the county iframe to its own content so readers use one normal page scroll.
  const county = document.getElementById('county-frame');
  const sizeCounty = () => {
    const child = county.contentDocument;
    const container = child && child.getElementById('htmlwidget_container');
    if (!container || county.dataset.resizing === 'ready') return;
    county.dataset.resizing = 'ready';
    // The original map remains unchanged on disk; only its embedded presentation adapts.
    child.documentElement.style.height = 'auto';
    child.body.style.height = 'auto';
    child.body.style.setProperty('padding','0','important');
    child.body.style.setProperty('background','#fbfbf7','important');
    const resize = () => { county.style.height = `${Math.ceil(container.getBoundingClientRect().height) + 12}px`; };
    // Recalculate when controls wrap or the two supporting graphs stack on phones.
    new ResizeObserver(resize).observe(container);
    resize();
  };
  county.addEventListener('load', sizeCounty);
  // A cached/local iframe can finish before its parent deferred script executes.
  if (county.contentDocument?.readyState === 'complete') sizeCounty();

  // Let the zoning usage graph and controls participate in the normal page scroll.
  const zoning = document.getElementById('zoning-frame');
  zoning.addEventListener('load', () => {
    const doc = zoning.contentDocument;
    if (!doc) return;
    const resize = () => { zoning.style.height = `${Math.ceil(doc.body.scrollHeight) + 8}px`; };
    new ResizeObserver(resize).observe(doc.body);
    resize();
  });

  // Reuse proper tab state for mouse activation and left/right keyboard selection.
  const tabs = [...document.querySelectorAll('.map-tabs [role="tab"]')];
  function selectMap(tab, immediate = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.dataset.panel);
      panel.hidden = !selected;
      const frame = panel.querySelector('iframe');
      // A reader's explicit tab choice loads immediately, even just below the viewport.
      if (selected && immediate) frame.loading = 'eager';
      // Load the larger zoning dataset only after a reader requests that map.
      if (selected && !frame.getAttribute('src')) frame.src = frame.dataset.src;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectMap(tab, true));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectMap(tabs[next], true); tabs[next].focus();
    });
  });
  // Native iframe lazy loading handles the default map after an anchor jump or scroll.
  // Assign its URL now so initialization does not depend on an observer timing race.
  selectMap(tabs.find(tab => tab.getAttribute('aria-selected') === 'true'));

  // Mark the visible study section in navigation without changing the reader's URL.
  const sectionObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      document.querySelectorAll('.site-header nav a').forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }
  }, {rootMargin:'-15% 0px -55% 0px'});
  document.querySelectorAll('#county, #weather, #infrastructure, #sources').forEach(section => sectionObserver.observe(section));
}
