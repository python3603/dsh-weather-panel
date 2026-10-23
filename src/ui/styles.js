/**
 * Stylesheets.
 *
 * Three parts, and why:
 * - `PANEL_BASE_CSS` holds the few primitives both surfaces use (buttons, chips,
 *   level badges, notes, links), so the startup notice can style itself without
 *   pulling in the whole panel sheet.
 * - `PANEL_BODY_CSS` holds the panel layout (cards, forecast, chart, typhoon).
 * - `MODAL_BODY_CSS` holds the notice dialog.
 *
 * Every selector is prefixed `dshw-`, chrome uses `--dsw-alias-*` tokens with
 * light fallbacks, and each sheet is a <style> element rendered by the component
 * that needs it — unmounting removes it, so nothing leaks into the host page.
 */

const PANEL_BASE_CSS = `
.dshw-btn{
  appearance:none;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:30px;padding:0 10px;
  border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  font:inherit;font-size:12px;line-height:18px;
  cursor:pointer;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease;
}
.dshw-btn:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-btn[disabled]{opacity:.55;cursor:default;}
.dshw-btn-icon{width:30px;padding:0;}
/*
 * The confirm action deliberately does NOT put white text on the brand colour:
 * with a pale brand (custom light themes) that combination is unreadable, which
 * is exactly what happened with the notice's "知道了". A neutral surface plus
 * the theme's own label colour is legible in every theme, and a brand-tinted
 * ring keeps it looking like the primary action.
 */
.dshw-btn-primary{
  background:var(--dsw-alias-bg-layer-1,#fff);
  border-color:var(--dsw-alias-border-l2,#d1d5db);
  color:var(--dsw-alias-label-primary,#1f2328);
  font-weight:600;
  box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary,#4f6ef7) 45%,transparent);
}
.dshw-btn-primary:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-chip{
  display:inline-flex;align-items:center;gap:4px;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  border-radius:999px;
  padding:1px 8px;
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-secondary,#6b7280);
  font-size:11px;line-height:16px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;
}
.dshw-chip-busy{color:var(--dsw-alias-label-secondary,#6b7280);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f6ef7) 45%,transparent);}
.dshw-chip-warn{color:var(--dsw-alias-state-warn-primary,#b45309);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b45309) 40%,transparent);}
.dshw-chip-active{color:var(--dsw-alias-state-error-primary,#dc2626);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 40%,transparent);}
.dshw-note{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-link{font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary,#1f2328);text-decoration:underline;text-underline-offset:2px;white-space:nowrap;}
.dshw-link:hover{text-decoration:underline;}
.dshw-level-chip{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  min-width:34px;height:18px;padding:0 6px;border-radius:5px;
  font-size:11px;line-height:18px;font-weight:600;color:#fff;
}
.dshw-level-blue{background:#3b82f6;}
.dshw-level-yellow{background:#eab308;color:#3f2d00;}
.dshw-level-orange{background:#f97316;}
.dshw-level-red{background:#dc2626;}
`;

const PANEL_BODY_CSS = `
.dshw-root{
  box-sizing:border-box;
  height:100%;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  background:var(--dsw-alias-bg-base,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  font-size:13px;
  line-height:20px;
  -webkit-font-smoothing:antialiased;
}
.dshw-root *,.dshw-root *::before,.dshw-root *::after{box-sizing:border-box;}
.dshw-inner{
  display:flex;
  flex-direction:column;
  gap:16px;
  max-width:1040px;
  margin:0 auto;
  padding:calc(26px + var(--dsh-frame-top-clearance,0px)) 24px 36px;
}
.dshw-header{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;}
.dshw-titles{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1 1 240px;}
.dshw-h1{margin:0;font-size:18px;line-height:26px;font-weight:600;letter-spacing:.01em;}
.dshw-sub{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;line-height:18px;min-width:0;}
.dshw-sub-strong{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;font-size:12px;}
.dshw-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;flex-wrap:wrap;}
.dshw-card{
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  border-radius:12px;
  background:var(--dsw-alias-bg-layer-1,#fff);
  padding:16px;
}
.dshw-now{display:flex;flex-wrap:wrap;gap:20px;align-items:center;}
.dshw-now-main{display:flex;align-items:center;gap:16px;min-width:230px;flex:1 1 250px;}
.dshw-glyph-box{flex:none;display:flex;align-items:center;justify-content:center;}
.dshw-now-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.dshw-temp{font-size:44px;line-height:46px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}
.dshw-cond{font-size:14px;line-height:20px;font-weight:600;}
.dshw-muted{color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-small{font-size:12px;line-height:18px;}
.dshw-now-params{flex:2 1 360px;display:flex;flex-direction:column;gap:12px;min-width:0;}
.dshw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(124px,1fr));gap:10px 18px;min-width:0;}
.dshw-param{display:flex;flex-direction:column;gap:1px;min-width:0;}
.dshw-param-k{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dshw-param-v{font-size:13px;line-height:20px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.dshw-sun-row{display:flex;flex-wrap:wrap;gap:8px 20px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);}
.dshw-sun-item{display:flex;align-items:baseline;gap:6px;min-width:0;}
.dshw-section{display:flex;flex-direction:column;gap:8px;min-width:0;}
.dshw-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px;}
.dshw-section-title{margin:0;font-size:13px;line-height:20px;font-weight:600;}
.dshw-forecast{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px;}
.dshw-day{display:flex;flex-direction:column;gap:10px;padding:14px;}
.dshw-day-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;}
.dshw-day-name{font-size:13px;line-height:20px;font-weight:600;}
.dshw-day-date{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;}
.dshw-day-body{display:flex;align-items:center;gap:10px;min-width:0;}
.dshw-day-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.dshw-day-cond{font-size:12px;line-height:18px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshw-day-temps{font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;}
.dshw-day-temps strong{font-size:15px;font-weight:600;}
.dshw-day-meta{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;}
.dshw-day-meta>div{display:flex;flex-direction:column;gap:0;min-width:0;}
.dshw-day-meta dt{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dshw-day-meta dd{margin:0;font-size:12px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums;}
.dshw-hours{
  display:flex;gap:6px;
  overflow-x:auto;overflow-y:hidden;
  padding:2px 2px 8px;
  scrollbar-width:thin;
  scroll-snap-type:x proximity;
}
.dshw-hour{
  flex:0 0 auto;width:62px;
  display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 2px;border-radius:10px;
  scroll-snap-align:start;
}
.dshw-hour:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-hour-time{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#6b7280);font-variant-numeric:tabular-nums;white-space:nowrap;}
.dshw-hour-temp{font-size:12px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums;}
.dshw-hour-pop{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary,#6b7280);font-variant-numeric:tabular-nums;}
.dshw-tabs{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:9px;background:var(--dsw-alias-bg-layer-1,#fff);align-self:flex-start;}
.dshw-tab{
  appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);
  font:inherit;font-size:12px;line-height:18px;padding:3px 12px;border-radius:7px;cursor:pointer;
}
.dshw-tab:hover{color:var(--dsw-alias-label-primary,#1f2328);}
.dshw-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-tab-active{background:var(--dsw-alias-bg-layer-2,#eef1f6);color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;}
.dshw-hint{
  display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b45309) 35%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b45309) 7%,transparent);
  border-radius:10px;padding:8px 12px;font-size:12px;line-height:18px;
}
.dshw-hint-text{min-width:0;color:var(--dsw-alias-label-primary,#1f2328);}
.dshw-alerts{display:flex;flex-direction:column;gap:8px;padding:14px 16px;}
.dshw-alerts-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dshw-alerts-head-right{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;}
.dshw-alerts-toggle{
  appearance:none;display:inline-flex;align-items:center;gap:4px;
  height:20px;padding:0 8px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  font:inherit;font-size:11px;line-height:18px;font-weight:600;cursor:pointer;white-space:nowrap;
}
.dshw-alerts-toggle:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-alerts-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-caret{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;transition:transform .15s ease;}
.dshw-caret-up{transform:rotate(180deg);}
/* Expanded rows wrap instead of truncating, so every alert is fully readable. */
.dshw-alerts-expanded .dshw-alert-row{align-items:flex-start;}
.dshw-alerts-expanded .dshw-alert-text{white-space:normal;overflow:visible;text-overflow:clip;}
.dshw-alert-list{display:flex;flex-direction:column;gap:4px;}
.dshw-alert-row{
  display:flex;align-items:center;gap:8px;min-width:0;
  padding:6px 8px;border-radius:8px;text-decoration:none;color:inherit;
}
.dshw-alert-row:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-alert-text{flex:1 1 0;min-width:0;font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshw-alert-scope{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-alerts-foot{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.dshw-chart{display:flex;flex-direction:column;gap:2px;min-width:0;}
.dshw-chart-svg{width:100%;height:126px;display:block;}
.dshw-chart-legend{display:flex;flex-wrap:wrap;gap:12px;padding:0 2px;}
.dshw-legend-item{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-legend-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;}
.dshw-legend-bar{background:var(--dsw-alias-brand-primary,#4f6ef7);opacity:.8;}
.dshw-legend-line{background:transparent;border-top:2px dashed var(--dsw-alias-label-tertiary,#8b93a1);height:0;border-radius:0;}
.dshw-legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;}
.dshw-bar{fill:var(--dsw-alias-brand-primary,#4f6ef7);fill-opacity:.78;}
.dshw-bar-group:hover .dshw-bar{fill-opacity:1;}
.dshw-bar-empty{fill:var(--dsw-alias-label-tertiary,#8b93a1);fill-opacity:.18;}
.dshw-chart-line{fill:none;stroke:var(--dsw-alias-label-tertiary,#8b93a1);stroke-width:1.4;stroke-dasharray:3 3;stroke-linejoin:round;}
.dshw-chart-baseline{stroke:var(--dsw-alias-border-l1,#e5e7eb);stroke-width:1;}
/* Axis labels are HTML positioned over the SVG (the plot itself is stretched, so
   text inside it would be distorted). */
.dshw-chart-axis{position:relative;height:13px;margin-top:2px;}
.dshw-chart-tick{
  position:absolute;top:0;transform:translateX(-50%);
  font-size:9px;line-height:13px;color:var(--dsw-alias-label-tertiary,#8b93a1);
  white-space:nowrap;font-variant-numeric:tabular-nums;
}
.dshw-chart-tick-start{transform:none;}
.dshw-chart-tick-end{transform:translateX(-100%);}
.dshw-chart-empty{padding:6px 2px;}
.dshw-typhoon{display:flex;flex-direction:column;gap:12px;min-width:0;}
.dshw-typhoon-head{display:flex;flex-direction:column;gap:10px;}
.dshw-typhoon-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.dshw-typhoon-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px;line-height:22px;}
.dshw-typhoon-name strong{font-size:16px;font-weight:600;}
.dshw-typhoon-select{display:inline-flex;align-items:center;gap:6px;}
.dshw-select{
  height:28px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:12px;padding:0 6px;max-width:190px;
}
.dshw-typhoon-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px 16px;}
.dshw-typhoon-map{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;}
.dshw-typhoon-svg{width:100%;max-width:720px;margin:0 auto;height:auto;display:block;border-radius:8px;}
.dshw-map-card{
  position:absolute;left:22px;top:22px;z-index:2;
  display:flex;flex-direction:column;gap:1px;
  max-width:min(56%,320px);
  padding:6px 9px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:color-mix(in srgb,var(--dsw-alias-bg-overlay,#fff) 92%,transparent);
  box-shadow:0 6px 18px rgba(15,23,42,.16);
  font-size:11px;line-height:16px;
  color:var(--dsw-alias-label-primary,#1f2328);
  pointer-events:none;
}
.dshw-map-card-head{display:flex;align-items:center;gap:6px;min-width:0;}
.dshw-map-card-badge{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  height:16px;padding:0 5px;border-radius:4px;color:#fff;
  font-size:10px;line-height:16px;font-weight:600;white-space:nowrap;
  text-shadow:0 1px 1px rgba(0,0,0,.35);
}
.dshw-map-card-time{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshw-map-card-chip{margin-left:auto;flex:none;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;}
.dshw-map-card-action{
  margin-left:auto;flex:none;pointer-events:auto;
  appearance:none;display:inline-flex;align-items:center;gap:3px;
  height:18px;padding:0 6px;border-radius:5px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4f6ef7) 45%,transparent);
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  font:inherit;font-size:10px;line-height:16px;font-weight:600;cursor:pointer;white-space:nowrap;
}
.dshw-map-card-action:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-map-card-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-map-card-line{color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dshw-map-card-pos{color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-crosshair line{stroke:var(--dsw-alias-label-tertiary,#8b93a1);stroke-width:.8;stroke-dasharray:2 3;stroke-opacity:.55;}
.dshw-hit{fill:transparent;pointer-events:all;}
.dshw-map-bg{fill:var(--dsw-alias-bg-layer-2,#f3f4f6);fill-opacity:.55;}
.dshw-land{fill:var(--dsw-alias-bg-layer-1,#fff);fill-opacity:.82;stroke:var(--dsw-alias-border-l2,#d1d5db);stroke-width:.7;stroke-linejoin:round;}
.dshw-grid-line{stroke:var(--dsw-alias-border-l1,#e5e7eb);stroke-width:.7;stroke-dasharray:2 4;}
.dshw-grid-label{fill:var(--dsw-alias-label-tertiary,#8b93a1);font-size:9px;}
.dshw-ref-city circle{fill:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-ref-city text{fill:var(--dsw-alias-label-tertiary,#8b93a1);font-size:9px;}
.dshw-wind-ring{fill-opacity:.05;stroke-opacity:.45;stroke-width:1;}
.dshw-wind-ring-1{fill-opacity:.07;stroke-opacity:.6;}
.dshw-wind-ring-2{fill-opacity:.09;stroke-opacity:.75;}
.dshw-track-line{fill:none;stroke:var(--dsw-alias-label-secondary,#6b7280);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;}
.dshw-forecast-line{fill:none;stroke:var(--dsw-alias-brand-primary,#4f6ef7);stroke-width:1.6;stroke-dasharray:4 4;stroke-linejoin:round;}
.dshw-track-dot{cursor:pointer;}
.dshw-track-dot:focus-visible{outline:none;}
.dshw-track-dot:hover .dshw-track-point{stroke:var(--dsw-alias-brand-primary,#4f6ef7);stroke-width:2;}
.dshw-track-point{stroke:var(--dsw-alias-bg-layer-1,#fff);stroke-width:1.2;}
.dshw-track-selected-ring{fill:none;stroke:var(--dsw-alias-state-error-primary,#dc2626);stroke-width:1.6;stroke-dasharray:3 2.5;}
.dshw-forecast-dot circle{fill:var(--dsw-alias-bg-layer-1,#fff);stroke-width:1.6;}
.dshw-forecast-label{fill:var(--dsw-alias-label-tertiary,#8b93a1);font-size:8px;}
.dshw-latest-ring{fill:none;stroke:var(--dsw-alias-state-error-primary,#dc2626);stroke-width:1;stroke-opacity:.6;stroke-dasharray:3 3;}
.dshw-typhoon-legend{display:flex;flex-wrap:wrap;gap:10px;}
.dshw-typhoon-detail{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px 16px;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);padding:12px 16px;
}
.dshw-typhoon-source{padding:0 2px;}
.dshw-picker{display:flex;flex-direction:column;gap:10px;}
.dshw-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.dshw-picker-actions{display:flex;flex-wrap:wrap;gap:8px;}
.dshw-switch-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 12px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  background:var(--dsw-alias-bg-layer-2,#f7f8fa);
}
.dshw-switch-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.dshw-switch-label{
  display:inline-flex;align-items:center;gap:6px;
  font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2328);
}
.dshw-switch-control{display:inline-flex;align-items:center;gap:8px;flex:none;}
.dshw-switch-state{
  font-size:11px;line-height:16px;font-weight:600;
  color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;
}
/* Contrast-safe on/off: the track uses the theme's strongest label colour, not
   the brand colour, so a pale brand cannot make both states look alike. */
.dshw-switch{
  appearance:none;position:relative;flex:none;width:38px;height:22px;padding:0;
  border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;
  transition:background-color .15s ease,border-color .15s ease;
}
.dshw-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-switch-knob{
  position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
  background:var(--dsw-alias-label-tertiary,#8b93a1);
  transition:transform .15s ease,background-color .15s ease;
}
.dshw-switch-on{
  background:color-mix(in srgb,var(--dsw-alias-label-primary,#1f2328) 18%,transparent);
  border-color:var(--dsw-alias-label-primary,#1f2328);
}
/* The knob uses the theme's label colour, not --dsw-alias-bg-base: some themes
   do not define that token, so the #fff fallback made the knob white on a white
   track and the switch read as an empty pill. label-primary always contrasts with
   the panel behind it, so both the knob and the ring stay visible in any theme. */
.dshw-switch-on .dshw-switch-knob{
  transform:translateX(16px);
  background:var(--dsw-alias-label-primary,#1f2328);
}
.dshw-switch-control[data-on="true"] .dshw-switch-state{color:var(--dsw-alias-label-primary,#1f2328);}
@media (prefers-reduced-motion:reduce){
  .dshw-switch,.dshw-switch-knob{transition:none;}
}
.dshw-search{
  display:flex;align-items:center;gap:8px;
  border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  border-radius:8px;
  padding:0 10px;height:34px;
  background:var(--dsw-alias-bg-base,#fff);
}
.dshw-search:focus-within{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-search-icon{display:inline-flex;color:var(--dsw-alias-label-tertiary,#8b93a1);flex:none;}
.dshw-input{
  flex:1;min-width:0;height:32px;
  border:0;background:transparent;color:inherit;
  font:inherit;font-size:13px;line-height:20px;
  outline:none;
}
.dshw-input::placeholder{color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-results{display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;}
.dshw-result{
  appearance:none;display:flex;flex-direction:column;gap:1px;
  padding:7px 10px;border-radius:8px;
  border:1px solid transparent;background:transparent;color:inherit;
  font:inherit;text-align:left;cursor:pointer;min-width:0;
}
.dshw-result:hover,.dshw-result:focus-visible{background:var(--dsw-alias-bg-layer-2,#f3f4f6);outline:none;border-color:var(--dsw-alias-border-l1,#e5e7eb);}
.dshw-result-name{font-size:13px;line-height:20px;font-weight:600;}
.dshw-result-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-alert{
  display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 35%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 8%,transparent);
  border-radius:10px;padding:10px 12px;
  font-size:12px;line-height:18px;
}
.dshw-loading{display:flex;flex-direction:column;gap:10px;}
.dshw-skeleton{
  height:132px;border-radius:12px;
  background:linear-gradient(90deg,var(--dsw-alias-bg-layer-1,#fff) 0%,var(--dsw-alias-bg-layer-2,#f3f4f6) 50%,var(--dsw-alias-bg-layer-1,#fff) 100%);
  background-size:200% 100%;
  animation:dshw-shimmer 1.4s ease-in-out infinite;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
}
@keyframes dshw-shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.dshw-footer{
  display:flex;flex-wrap:wrap;gap:2px 14px;
  padding:2px;
  font-size:11px;line-height:16px;
  color:var(--dsw-alias-label-tertiary,#8b93a1);
}
.dshw-footer a{color:inherit;text-decoration:underline;text-underline-offset:2px;}
.dshw-footer a:hover{color:var(--dsw-alias-label-primary,#1f2328);}
.dshw-footer-feedback{margin-left:auto;}
.dshw-footer-feedback a{font-weight:600;text-decoration:none;}

/* ---- location mode: two explicit choices ---- */
.dshw-segmented{display:flex;gap:6px;flex-wrap:wrap;}
.dshw-seg{
  appearance:none;flex:1 1 0;min-width:0;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:30px;padding:0 10px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-secondary,#6b7280);
  font:inherit;font-size:12px;line-height:18px;font-weight:600;cursor:pointer;white-space:nowrap;
}
.dshw-seg:hover{background:var(--dsw-alias-bg-layer-2,#f3f4f6);}
.dshw-seg:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px;}
.dshw-seg-active{
  color:var(--dsw-alias-label-primary,#1f2328);
  border-color:var(--dsw-alias-label-primary,#1f2328);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-label-primary,#1f2328);
}
.dshw-picker-manual{color:var(--dsw-alias-label-primary,#1f2328);}

/* ---- alerts: type icon + issue time ---- */
.dshw-alert-icon{flex:none;font-size:13px;line-height:18px;}
.dshw-alert-time{
  flex:none;font-size:10px;line-height:16px;
  color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;
  font-variant-numeric:tabular-nums;
}

/* ---- chart: right-hand probability scale ---- */
.dshw-chart-plot{position:relative;padding-right:26px;}
.dshw-chart-axis-y{
  position:absolute;top:0;right:0;width:24px;height:126px;
  font-size:9px;line-height:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);
  font-variant-numeric:tabular-nums;pointer-events:none;
}
.dshw-chart-axis-y span{position:absolute;right:0;transform:translateY(-50%);}

/* ---- typhoon: no active system ---- */
.dshw-typhoon-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 18px;text-align:center;}
.dshw-typhoon-empty-icon{font-size:26px;line-height:1;filter:grayscale(.15);}
.dshw-typhoon-empty-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
.dshw-typhoon-nonebar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dshw-legend-group{font-weight:600;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-legend-sep{width:1px;height:10px;background:var(--dsw-alias-border-l1,#e5e7eb);}
.dshw-legend-ring{
  display:inline-block;width:12px;height:8px;border-radius:50%;
  border:1.5px solid transparent;background:transparent;
}

/* ---- compact segmented control (range / date switches inside cards) ---- */
.dshw-segmented-compact .dshw-seg{flex:0 0 auto;height:24px;padding:0 9px;font-size:11px;line-height:16px;border-radius:7px;}

/* ---- history temperature curve ---- */
.dshw-history{display:flex;flex-direction:column;gap:8px;padding:14px 16px;}
.dshw-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
/* 坐标：SVG 高度固定 160px → y 用像素落位，x 用百分比；轴标签 / 圆点都是 HTML，比例与数据严格一致。 */
.dshw-history-canvas{position:relative;height:176px;}
.dshw-history-axis-y{position:absolute;left:0;top:0;width:38px;height:160px;pointer-events:none;}
.dshw-history-axis-y span{
  position:absolute;right:6px;transform:translateY(-50%);
  font-size:10px;line-height:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
.dshw-history-plot{position:relative;margin-left:40px;margin-right:4px;height:160px;}
.dshw-history-svg{width:100%;height:160px;display:block;overflow:visible;}
.dshw-history-grid{stroke:var(--dsw-alias-border-l1,#e5e7eb);stroke-width:1;stroke-dasharray:2 4;}
.dshw-history-axis-x{position:absolute;left:0;right:0;top:162px;height:14px;font-size:9px;line-height:14px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-history-axis-x span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap;font-variant-numeric:tabular-nums;}
.dshw-history-tick-start{transform:none;}
.dshw-history-tick-end{transform:translateX(-100%);}
.dshw-history-dot{
  position:absolute;width:6px;height:6px;border-radius:50%;transform:translate(-50%,-50%);
  box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-1,#fff);
}
.dshw-history-dot-max{background:#ef4444;}
.dshw-history-dot-min{background:#38bdf8;}
.dshw-history-band{fill:var(--dsw-alias-brand-primary,#4f6ef7);fill-opacity:.12;}
.dshw-history-max{fill:none;stroke:#ef4444;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;}
.dshw-history-min{fill:none;stroke:#38bdf8;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;}
.dshw-history-axis-x{display:flex;justify-content:space-between;font-size:9px;line-height:13px;color:var(--dsw-alias-label-tertiary,#8b93a1);font-variant-numeric:tabular-nums;}
.dshw-history-skeleton{height:148px;}
.dshw-history-foot{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dshw-history-legend{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-legend-max{background:#ef4444;}
.dshw-legend-min{background:#38bdf8;}

/* ---- satellite ---- */
.dshw-sat{display:flex;flex-direction:column;gap:10px;padding:14px 16px;}
.dshw-sat-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dshw-sat-controls{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;}
.dshw-sat-field{display:flex;flex-direction:column;gap:3px;min-width:0;}

/* media frame（雷达 / 卫星共用）*/
/* ---- radar ---- */
.dshw-radar{display:flex;flex-direction:column;gap:10px;padding:14px 16px;}
.dshw-radar-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dshw-radar-controls{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;}
.dshw-radar-field{display:flex;flex-direction:column;gap:3px;min-width:0;}
.dshw-radar-select{
  height:28px;padding:0 8px;border-radius:7px;
  border:1px solid var(--dsw-alias-border-l2,#d1d5db);
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  font:inherit;font-size:12px;line-height:18px;
}
.dshw-radar-time{display:flex;flex-direction:column;gap:3px;}
.dshw-radar-clock{font-size:13px;line-height:18px;font-variant-numeric:tabular-nums;}
.dshw-radar-scrub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dshw-radar-range{flex:1 1 140px;min-width:110px;accent-color:var(--dsw-alias-label-primary,#1f2328);}
.dshw-media-frame{
  position:relative;display:flex;align-items:center;justify-content:center;
  /* Fixed viewport: the official products are ~825x739, which at full panel width
     is taller than a short window can show. A fixed, viewport-relative box with a
     contained image always shows the whole product — and stops the layout from
     jumping while frames play. */
  height:clamp(220px,calc(100vh - 300px),440px);
  border-radius:10px;overflow:hidden;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  background:var(--dsw-alias-bg-layer-2,#f7f8fa);
}
.dshw-media-link{appearance:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in;}
.dshw-zoom{
  position:fixed;inset:0;z-index:2147483000;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  padding:24px;background:rgba(6,10,18,.86);
}
.dshw-zoom-img{
  max-width:min(92vw,1600px);max-height:76vh;
  border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#fff;
}
.dshw-zoom-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;}
.dshw-zoom-meta{font-size:12px;line-height:16px;color:#e5e7eb;}
.dshw-zoom .dshw-btn{background:#fff;color:#1f2328;border-color:rgba(255,255,255,.5);}
.dshw-zoom .dshw-btn:hover{background:#f3f4f6;}
.dshw-media-img{
  display:block;max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;
}
.dshw-media-skeleton{
  position:absolute;inset:0;
  background:linear-gradient(100deg,transparent 20%,var(--dsw-alias-bg-layer-1,#fff) 50%,transparent 80%);
  background-size:200% 100%;animation:dshw-shimmer 1.6s linear infinite;
}
.dshw-media-broken{position:relative;z-index:1;}
.dshw-radar-foot{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
@media (max-width:720px){
  .dshw-inner{padding-left:14px;padding-right:14px;}
  .dshw-forecast{grid-template-columns:minmax(0,1fr);}
  .dshw-temp{font-size:38px;line-height:40px;}
  .dshw-now-main{min-width:0;}
}
@media (prefers-reduced-motion:reduce){
  .dshw-skeleton{animation:none;}
  .dshw-btn{transition:none;}
}
`;

const MODAL_BODY_CSS = `
.dshw-modal-root{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto;}
.dshw-modal-backdrop{position:absolute;inset:0;background:rgba(12,16,24,.42);}
.dshw-modal{
  position:relative;
  width:min(480px,100%);
  max-height:min(80vh,560px);
  display:flex;flex-direction:column;
  border-radius:14px;
  border:1px solid var(--dsw-alias-border-l2,#e5e7eb);
  background:var(--dsw-alias-bg-overlay,#fff);
  color:var(--dsw-alias-label-primary,#1f2328);
  box-shadow:0 18px 48px rgba(15,23,42,.28);
  overflow:hidden;
  font-size:13px;line-height:20px;
}
.dshw-modal *{box-sizing:border-box;}
.dshw-modal-head{display:flex;align-items:center;gap:12px;padding:16px 16px 12px;}
.dshw-modal-icon{flex:none;display:flex;align-items:center;justify-content:center;}
.dshw-modal-titles{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;}
.dshw-modal-title{margin:0;font-size:15px;line-height:22px;font-weight:600;}
.dshw-modal-body{padding:0 16px 4px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;}
.dshw-notice-block{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);padding-top:10px;}
.dshw-notice-block:first-child{border-top:0;padding-top:0;}
.dshw-notice-heading{margin:0;display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;font-weight:600;}
.dshw-notice-text{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-notice-list{display:flex;flex-direction:column;gap:4px;}
.dshw-notice-alert{
  display:flex;align-items:center;gap:8px;min-width:0;
  padding:5px 0;text-decoration:none;color:inherit;font-size:12px;line-height:18px;
}
.dshw-notice-alert:hover .dshw-notice-alert-text{text-decoration:underline;}
.dshw-notice-alert-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshw-modal-foot{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:14px 16px 16px;border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);
}
@media (max-width:520px){
  .dshw-modal-root{padding:12px;align-items:flex-end;}
  .dshw-modal{width:100%;max-height:86vh;}
}
`;

/** Panel sheet: primitives + layout. */
const PANEL_CSS = PANEL_BASE_CSS + PANEL_BODY_CSS;

/** Notice sheet: primitives + dialog only. */
const WEATHER_MODAL_CSS = PANEL_BASE_CSS + MODAL_BODY_CSS;
