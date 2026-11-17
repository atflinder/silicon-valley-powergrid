// Keep explorer variables scoped to this block rather than adding report-wide globals.
{
  // Locate the report's accessible explorer container and embedded complete-day data.
  const explorer = document.getElementById('demand-explorer');
  // This is nonexecuting JSON written by R from the same daily sample as the static graph.
  const payload = document.getElementById('demand-data');
  // Initialise only when both HTML-only elements exist; PDF rendering omits this script.
  if (explorer && payload) {
    // Parse local embedded values; no request, API key, or external library is involved.
    const observations = JSON.parse(payload.textContent);
    // Retain references to the three labelled native filter controls.
    const yearFilter = document.getElementById('demand-year');
    // Seasons are explicit text labels matching R's meteorological-season categories.
    const seasonFilter = document.getElementById('demand-season');
    // Day type distinguishes calendar weekdays/weekends, without separating holidays.
    const typeFilter = document.getElementById('demand-type');
    // Update this live region whenever the selected sample changes.
    const summary = document.getElementById('demand-summary');
    // Keep point details separate from the sample-wide descriptive summary.
    const detail = document.getElementById('demand-detail');
    // Draw all scientific evidence in the labelled responsive SVG.
    const svg = document.getElementById('demand-svg');
    // Use the same named season colours as the R figures.
    const colours = {Winter:'#2878A8', Spring:'#168574', Summer:'#D78216', Fall:'#8B60A8'};
    // Reserve space for axis labels within the 900-by-470 viewBox.
    const margins = {left:78, top:20, right:25, bottom:65};
    // Calculate the plot's usable width after horizontal margins.
    const plotWidth = 900 - margins.left - margins.right;
    // Calculate the usable height after vertical margins.
    const plotHeight = 470 - margins.top - margins.bottom;
    // Fix the horizontal range from ALL observations, not the currently selected subset.
    const xMin = Math.floor(Math.min(...observations.map(d => d.temperature_f))/5)*5;
    // Round the upper temperature bound outward to include every day.
    const xMax = Math.ceil(Math.max(...observations.map(d => d.temperature_f))/5)*5;
    // Fix the daily-energy range across all filter choices as well.
    const yMin = Math.floor(Math.min(...observations.map(d => d.daily_gwh))/100)*100;
    // Round the upper energy bound outward in GWh/day.
    const yMax = Math.ceil(Math.max(...observations.map(d => d.daily_gwh))/100)*100;
    // Reuse this linear conversion for grid positions and plotted daily temperatures.
    const xPosition = value => margins.left + (value-xMin)/(xMax-xMin)*plotWidth;
    // Invert SVG's downward y direction so higher energy appears higher on the graph.
    const yPosition = value => margins.top + plotHeight - (value-yMin)/(yMax-yMin)*plotHeight;
    // Keep the currently displayed point elements for keyboard navigation after filtering.
    let pointElements = [];

    // Reuse this SVG factory for grid lines, axes, labels, titles, and observations.
    function svgElement(name, attributes, text) {
      // Use the SVG namespace so the browser renders shapes rather than HTML elements.
      const element = document.createElementNS('http://www.w3.org/2000/svg', name);
      // Assign each requested attribute without constructing HTML from data values.
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
      // Add label text safely when this element needs a visible or accessible description.
      if (text !== undefined) element.textContent = text;
      // Attach the new element to this graph in drawing order.
      svg.appendChild(element);
      // Return the element for optional point-specific events or title children.
      return element;
    }

    // Use one consistent date/value description for mouse, keyboard, and accessible labels.
    function pointDescription(day) {
      // Daily GWh and daily mean F are descriptive observed/model values, not predictions.
      return `${day.date} (${day.day_type}, ${day.season}): San Jose ${day.temperature_f.toFixed(1)} F; CAISO ${day.daily_gwh.toFixed(1)} GWh/day`;
    }

    // Recalculate the visible observations and summary whenever ANY filter changes.
    function renderExplorer() {
      // Apply year, season, and day-type restrictions together to the complete-day sample.
      const selected = observations.filter(day =>
        // An All value keeps all calendar years; otherwise match the selected year exactly.
        (yearFilter.value === 'All' || String(day.year) === yearFilter.value) &&
        // Keep all seasons or the single meteorological season chosen by the reader.
        (seasonFilter.value === 'All' || day.season === seasonFilter.value) &&
        // Apply the weekday/weekend restriction independently of the other two filters.
        (typeFilter.value === 'All' || day.day_type === typeFilter.value));
      // Recompute vertical-axis extrema from the visible sample, never from hidden years/seasons.
      const highestEnergy = selected.length ? Math.max(...selected.map(day => day.daily_gwh)) : null;
      // Keep a separate low value so a filter's least-demanding day can be highlighted accurately.
      const lowestEnergy = selected.length ? Math.min(...selected.map(day => day.daily_gwh)) : null;
      // Remove the previous drawing, including stale focusable points.
      svg.replaceChildren();
      // Reset keyboard-navigation references to the new selected point set.
      pointElements = [];
      // Make the visible sample size available for automated checks as well as the reader.
      explorer.dataset.points = String(selected.length);
      // Give assistive technology a chart description containing the current sample size.
      svg.setAttribute('aria-label', `${selected.length} complete CAISO days: San Jose daily mean temperature versus daily electricity`);
      // Draw temperature grid/tick labels on the fixed full-sample horizontal range.
      for (let tick=xMin; tick<=xMax; tick+=10) {
        // Use pale full-height grid lines behind the observations.
        svgElement('line', {x1:xPosition(tick), x2:xPosition(tick), y1:margins.top, y2:margins.top+plotHeight, stroke:'#e2e8f0'});
        // Put temperature tick values below the plotting area.
        svgElement('text', {x:xPosition(tick), y:margins.top+plotHeight+24, 'text-anchor':'middle', fill:'#243447', 'font-size':15}, tick);
      }
      // Draw energy grid/tick labels on the fixed full-sample vertical range.
      for (let tick=yMin; tick<=yMax; tick+=100) {
        // Draw horizontal reference lines before adding daily points.
        svgElement('line', {x1:margins.left, x2:margins.left+plotWidth, y1:yPosition(tick), y2:yPosition(tick), stroke:'#e2e8f0'});
        // Place GWh/day tick values to the left of the plotting area.
        svgElement('text', {x:margins.left-10, y:yPosition(tick)+5, 'text-anchor':'end', fill:'#243447', 'font-size':15}, tick);
      }
      // Name the local temperature indicator and its unit explicitly.
      svgElement('text', {x:margins.left+plotWidth/2, y:460, 'text-anchor':'middle', fill:'#243447', 'font-size':18}, 'San Jose daily mean temperature (F)');
      // Rotate the regional daily-energy label while keeping it inside the SVG frame.
      svgElement('text', {transform:'translate(20 212) rotate(-90)', 'text-anchor':'middle', fill:'#243447', 'font-size':18}, 'CAISO daily energy (GWh)');
      // Draw one point per selected complete reporting day, with no smooth or fitted effect.
      for (const [index, day] of selected.entries()) {
        // Preserve season colour, partial opacity, and full-source coordinate values.
        const point = svgElement('circle', {cx:xPosition(day.temperature_f), cy:yPosition(day.daily_gwh), r:3.6, fill:colours[day.season], 'fill-opacity':0.52, class:'demand-point', tabindex:index===0?0:-1, role:'button', 'aria-label':pointDescription(day)});
        // Add the source date as metadata for direct verification of a plotted observation.
        point.dataset.date = day.date;
        // Keep every tied high/low observation visible with a larger black ring.
        if (day.daily_gwh === highestEnergy || day.daily_gwh === lowestEnergy) {
          // Enlarge the original point without adding fake observations to the chart.
          point.setAttribute('r', '6');
          // A black outline works in grayscale and preserves the underlying season colour.
          point.setAttribute('stroke', '#111827');
          // Use a clear outline width for the highlighted observation.
          point.setAttribute('stroke-width', '2');
          // Identify highlighted observations for accessibility and independent browser checks.
          point.dataset.extreme = highestEnergy === lowestEnergy ? 'High = low' : day.daily_gwh === highestEnergy ? 'High' : 'Low';
          // Announce the selected-sample extreme when a reader focuses this point.
          point.setAttribute('aria-label', `${point.dataset.extreme} selected daily energy. ${pointDescription(day)}`);
        }
        // Supply a native hover tooltip without displaying HTML from dataset values.
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        // Use the same date, temperature, and energy wording as the accessible label.
        title.textContent = pointDescription(day);
        // Nest the tooltip inside its daily observation rather than the chart as a whole.
        point.appendChild(title);
        // Show details immediately when the pointer enters a point.
        point.addEventListener('mouseenter', () => { detail.textContent = pointDescription(day); });
        // Keyboard focus exposes exactly the same information as pointer hover.
        point.addEventListener('focus', () => { detail.textContent = pointDescription(day); });
        // Clicking also selects details, which supports touch interaction.
        point.addEventListener('click', () => { detail.textContent = pointDescription(day); });
        // Retain this element for left/right arrow navigation within the current sample.
        pointElements.push(point);
      }
      // Put compact text beside each selected-sample extremum; mark all ties but label one date.
      for (const [kind, value] of highestEnergy === lowestEnergy ? [['High = low', highestEnergy]] : [['High', highestEnergy], ['Low', lowestEnergy]]) {
        // Empty selections must not produce fabricated high/low observations.
        if (!selected.length) continue;
        // Include all tied dates and use their existing chronological order for a representative label.
        const tiedDays = selected.filter(day => day.daily_gwh === value);
        // The first matching day is a real plotted observation, not an interpolated point.
        const day = tiedDays[0];
        // Keep labels inward at the left/right of the fixed temperature axis.
        const fraction = (day.temperature_f-xMin)/(xMax-xMin);
        // Left-edge labels extend right; right-edge labels extend left.
        const anchor = fraction < 0.25 ? 'start' : fraction > 0.75 ? 'end' : 'middle';
        // High labels sit below their point; low labels sit above it within the plot frame.
        const labelY = yPosition(value) + (kind === 'High' ? 22 : -28);
        // Expose the quantity and any ties directly in the visible annotation.
        const label = `${kind} ${value.toFixed(1)} GWh/day${tiedDays.length>1 ? ` (${tiedDays.length} tied)` : ''}`;
        // Draw dark text with a white halo so underlying points do not obscure the value.
        svgElement('text', {x:xPosition(day.temperature_f), y:labelY, 'text-anchor':anchor, fill:'#111827', stroke:'white', 'stroke-width':4, 'paint-order':'stroke', 'font-size':15, 'font-weight':600, class:'demand-extreme-label'}, label);
        // Identify the actual selected date on a second line using the same readable halo.
        svgElement('text', {x:xPosition(day.temperature_f), y:labelY+17, 'text-anchor':anchor, fill:'#111827', stroke:'white', 'stroke-width':4, 'paint-order':'stroke', 'font-size':14}, day.date);
      }
      // Do not fabricate means or points when a future filter combination has no observations.
      if (!selected.length) summary.textContent = 'No complete days match these filters.';
      // Calculate and display descriptive sample means only when the selection is nonempty.
      else {
        // Average daily energy with one equal weight per selected complete day.
        const meanEnergy = selected.reduce((sum, day) => sum+day.daily_gwh, 0)/selected.length;
        // Average daily mean temperature over the same selected dates.
        const meanTemperature = selected.reduce((sum, day) => sum+day.temperature_f, 0)/selected.length;
        // Announce sample size and units; a changed mean is not a causal effect estimate.
        summary.textContent = `${selected.length.toLocaleString()} complete days; mean CAISO energy ${meanEnergy.toFixed(1)} GWh/day; mean San Jose temperature ${meanTemperature.toFixed(1)} F. Axes stay fixed.`;
      }
      // Reset stale point details and explain how to enter and navigate the graph by keyboard.
      detail.textContent = 'Hover or click a point for details. Keyboard: Tab to the first point, then use the arrow keys.';
    }

    // Let one Tab stop enter the graph; arrow keys move among observations without 1,813 Tab stops.
    svg.addEventListener('keydown', event => {
      // Ignore keys that do not request point navigation or selection.
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)) return;
      // Identify the currently focused observation within the selected data, not the full sample.
      const index = pointElements.indexOf(event.target);
      // Leave ordinary SVG/document keyboard actions alone when no point has focus.
      if (index < 0) return;
      // Prevent arrow scrolling and the space key's page movement during point navigation.
      event.preventDefault();
      // Treat Enter/Space as selecting the currently focused day's details.
      if (event.key === 'Enter' || event.key === ' ') { event.target.click(); return; }
      // Move forwards for right/down and backwards for left/up, wrapping at the ends.
      const step = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
      // Calculate the next valid point index, including wraparound from the first/last point.
      const next = (index+step+pointElements.length)%pointElements.length;
      // Remove the old point from the document's Tab sequence.
      pointElements[index].setAttribute('tabindex', '-1');
      // Make the new point the graph's single Tab destination.
      pointElements[next].setAttribute('tabindex', '0');
      // Focus triggers the same visible detail update used for pointer selection.
      pointElements[next].focus();
    });
    // Reuse the rendering function after any of the three native controls changes.
    for (const control of [yearFilter, seasonFilter, typeFilter]) control.addEventListener('change', renderExplorer);
    // Draw all complete days initially; later calls are driven by the filter controls.
    renderExplorer();
  }
}
