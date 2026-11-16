(function () {
  "use strict";

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function fmtLei(n) {
    return Math.round(n).toLocaleString("en-GB") + " lei";
  }

  function animateNumber(el, to, suffix, ms) {
    suffix = suffix || "";
    ms = ms || 900;
    var from = 0;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / ms);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(from + (to - from) * eased);
      el.textContent = val.toLocaleString("en-GB") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function barChart(container, data, opts) {
    opts = opts || {};
    var labelKey = opts.labelKey, valueKey = opts.valueKey, altValueKey = opts.altValueKey;
    var valueFmt = opts.valueFmt || function (d) { return d; };
    var width = container.clientWidth || 600;
    var narrow = width < 520;
    var rowH = narrow ? 56 : 40;
    var height = data.length * rowH + 16;
    var margin = { top: 8, right: narrow ? 18 : 70, bottom: 8, left: narrow ? 12 : 200 };

    var svg = d3.select(container).append("svg")
      .attr("width", "100%")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("role", "img")
      .attr("aria-label", opts.ariaLabel || "Bar chart");

    var innerW = width - margin.left - margin.right;
    var maxVal = d3.max(data, function (d) { return d[valueKey]; }) || 1;
    var x = d3.scaleLinear().domain([0, maxVal * (narrow ? 1.35 : 1.12)]).range([0, innerW]);
    var y = d3.scaleBand().domain(data.map(function (d) { return d[labelKey]; }))
      .range([0, data.length * rowH]).padding(0.28);

    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var barColor = cssVar("--bar") || "#c7cdd6";
    var strongColor = cssVar("--bar-strong") || "#9a5b00";
    var inkColor = cssVar("--ink") || "#111";
    var mutedColor = cssVar("--muted") || "#777";

    var rows = g.selectAll(".row").data(data).join("g")
      .attr("class", "row")
      .attr("transform", function (d) { return "translate(0," + y(d[labelKey]) + ")"; });

    if (!narrow) {
      rows.append("text")
        .attr("x", -12)
        .attr("y", y.bandwidth() / 2)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("class", "bar-label")
        .text(function (d) { return d[labelKey]; });
    } else {
      rows.append("text")
        .attr("x", 0)
        .attr("y", -6)
        .attr("class", "bar-label")
        .text(function (d) { return d[labelKey]; });
    }

    var barY0 = narrow ? 2 : 0;
    var barH = y.bandwidth() - (narrow ? 2 : 0);

    rows.append("rect")
      .attr("x", 0)
      .attr("y", barY0)
      .attr("height", barH)
      .attr("rx", 3)
      .attr("fill", barColor)
      .attr("width", 0)
      .transition().duration(850).delay(function (_, i) { return i * 90; })
      .attr("width", function (d) { return x(d[valueKey]); });

    if (altValueKey) {
      rows.append("rect")
        .attr("x", 0)
        .attr("y", barY0)
        .attr("height", barH)
        .attr("rx", 3)
        .attr("fill", strongColor)
        .attr("width", 0)
        .transition().duration(850).delay(function (_, i) { return i * 90 + 120; })
        .attr("width", function (d) { return x(d[altValueKey] || 0); });
    }

    rows.append("text")
      .attr("x", function (d) { return x(d[valueKey]) + 8; })
      .attr("y", barY0 + barH / 2)
      .attr("dy", "0.32em")
      .attr("class", "bar-value")
      .attr("opacity", 0)
      .text(function (d) { return valueFmt(d[valueKey]); })
      .transition().duration(400).delay(function (_, i) { return i * 90 + 850; })
      .attr("opacity", 1);

    return svg;
  }

  fetch("stats/market.json")
    .then(function (r) { return r.json(); })
    .then(function (data) { render(data); })
    .catch(function (err) {
      console.error("Could not load market.json", err);
    });

  function render(data) {
    document.getElementById("updated").textContent = "Updated " + data.generated;
    document.getElementById("gen-date").textContent = data.generated;

    // KPIs
    var kpis = document.getElementById("kpis");
    var kpiDefs = [
      { n: data.status.active, l: "Active companies" },
      { n: data.status.inactive_iscir, l: "Inactive (ISCIR)" },
      { n: data.status.inactive_anaf, l: "Inactive (ANAF)" },
      { n: data.inspection_provider.entities_with_financial_data, l: "Inspection providers" }
    ];
    kpiDefs.forEach(function (k) {
      var div = document.createElement("div");
      div.className = "kpi";
      var n = document.createElement("div");
      n.className = "n";
      var l = document.createElement("div");
      l.className = "l";
      l.textContent = k.l;
      div.appendChild(n);
      div.appendChild(l);
      kpis.appendChild(div);
      animateNumber(n, k.n);
    });

    // Categories bar chart
    barChart(document.getElementById("chart-categories"), data.categories, {
      labelKey: "category",
      valueKey: "entities",
      altValueKey: "with_third_party_accreditation",
      valueFmt: function (d) { return d; },
      ariaLabel: "Companies by activity category"
    });

    // Turnover: single animated number
    var turnoverWrap = document.getElementById("chart-turnover");
    var big = document.createElement("div");
    big.style.fontFamily = "var(--font-display)";
    big.style.fontSize = "clamp(28px, 5vw, 44px)";
    big.style.fontWeight = "700";
    big.style.color = "var(--accent)";
    turnoverWrap.appendChild(big);
    var label = document.createElement("div");
    label.className = "muted";
    label.textContent = "median annual turnover, " + data.inspection_provider.entities_with_financial_data + " inspection providers with financial data";
    turnoverWrap.appendChild(label);
    animateNumber(big, Math.round(data.inspection_provider.median_turnover_lei), " lei", 1100);
    document.getElementById("turnover-note").textContent = data.inspection_provider.note;

    // Counties bar chart
    barChart(document.getElementById("chart-counties"), data.counties, {
      labelKey: "county",
      valueKey: "entities",
      valueFmt: function (d) { return d; },
      ariaLabel: "Inspection providers by county"
    });
    document.getElementById("counties-note").textContent =
      "Only counties with at least " + data.q5_threshold + " distinct companies are shown individually. " +
      data.counties_suppressed_below_q5 + " further counties fall below this threshold and are not broken out.";

    // Confidence + limitations
    document.getElementById("confidence-note").textContent = data.confidence + ". Source: " + data.source + ".";
    var ul = document.getElementById("limitations-list");
    data.limitations.forEach(function (l) {
      var li = document.createElement("li");
      li.textContent = l;
      ul.appendChild(li);
    });
  }
})();
