/**
 * 共用的大图查看层（雷达拼图 / 卫星云图都用它）。
 *
 * `position: fixed` 的整窗浮层：点背景或按 Esc 关闭，图片等比铺满窗口，
 * 底部保留「打开原图 / 关闭」两个动作。
 */
function MediaZoom(props) {
  const { open, url, alt, meta, t, onClose } = props;

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !url) return null;

  return h('div', {
    className: 'dshw-zoom',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('zoom.title'),
    onClick: onClose
  },
    h('img', {
      className: 'dshw-zoom-img',
      src: url,
      alt: alt || '',
      referrerPolicy: 'no-referrer',
      decoding: 'async',
      onClick: event => event.stopPropagation()
    }),
    h('div', { className: 'dshw-zoom-bar', onClick: event => event.stopPropagation() },
      h('span', { className: 'dshw-zoom-meta' }, meta || ''),
      h('a', {
        className: 'dshw-btn',
        href: url,
        target: '_blank',
        rel: 'noreferrer noopener'
      }, t('zoom.openOriginal')),
      h('button', { type: 'button', className: 'dshw-btn', onClick: onClose }, t('zoom.close'))
    )
  );
}
