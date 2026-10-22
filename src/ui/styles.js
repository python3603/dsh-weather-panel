/**
 * Panel stylesheet.
 *
 * - Every selector is prefixed `dshw-`, so nothing here can collide with the
 *   host or another plugin.
 * - Chrome uses `--dsw-alias-*` theme tokens only; each has a light fallback so
 *   an older Host that renamed a token still renders instead of breaking.
 * - The stylesheet is rendered by the panel itself as a <style> element, so it
 *   is removed the moment the panel unmounts (no global stylesheet leaks).
 */

const PANEL_CSS = `
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
.dshw-chip{
  display:inline-flex;align-items:center;gap:4px;
  border:1px solid var(--dsw-alias-border-l1,#e5e7eb);
  border-radius:999px;
  padding:1px 8px;
  background:var(--dsw-alias-bg-layer-1,#fff);
  color:var(--dsw-alias-label-secondary,#6b7280);
  font-size:11px;line-height:16px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;
}
.dshw-chip-busy{color:var(--dsw-alias-brand-primary,#4f6ef7);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f6ef7) 35%,transparent);}
.dshw-chip-warn{color:var(--dsw-alias-state-warn-primary,#b45309);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b45309) 40%,transparent);}
.dshw-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;flex-wrap:wrap;}
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
.dshw-param-v small{margin-left:3px;font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary,#6b7280);}
.dshw-sun-row{display:flex;flex-wrap:wrap;gap:8px 20px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);}
.dshw-sun-item{display:flex;align-items:baseline;gap:6px;min-width:0;}
.dshw-section{display:flex;flex-direction:column;gap:8px;min-width:0;}
.dshw-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px;}
.dshw-section-title{margin:0;font-size:13px;line-height:20px;font-weight:600;}
.dshw-note{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.dshw-forecast{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
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
.dshw-hour-pop{font-size:10px;line-height:14px;color:var(--dsw-alias-brand-primary,#4f6ef7);font-variant-numeric:tabular-nums;}
.dshw-picker{display:flex;flex-direction:column;gap:10px;}
.dshw-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.dshw-picker-actions{display:flex;flex-wrap:wrap;gap:8px;}
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
.dshw-footer a:hover{color:var(--dsw-alias-brand-primary,#4f6ef7);}
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
