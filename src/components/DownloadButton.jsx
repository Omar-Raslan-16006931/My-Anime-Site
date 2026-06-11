function toDriveDownloadUrl(url) {
  if (!url) return ''

  if (url.includes('drive.google.com/uc?export=download&id=')) {
    return url
  }

  const fileMatch =
    url.match(/\/file\/d\/([^/]+)/) ||
    url.match(/[?&]id=([^&]+)/)

  const fileId = fileMatch?.[1]

  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }

  return url
}

export default function DownloadButton({
  url,
  label = 'Download',
  isMobile = false,
  fullWidth = false,
  variant = 'secondary',
  style = {},
  onClick
}) {
  const finalUrl = toDriveDownloadUrl(url)

  const handleClick = (e) => {
    e.stopPropagation()
    if (!finalUrl) return
    onClick?.(finalUrl)
    window.open(finalUrl, '_blank', 'noopener,noreferrer')
  }

  const baseStyle = {
    appearance: 'none',
    WebkitAppearance: 'none',
    border: variant === 'primary' ? 'none' : '1px solid var(--border)',
    outline: 'none',
    background:
      variant === 'primary'
        ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
        : 'var(--bg3)',
    color: variant === 'primary' ? '#fff' : 'var(--text)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: isMobile ? 38 : 42,
    minWidth: isMobile ? 42 : undefined,
    width: fullWidth ? '100%' : 'auto',
    padding: isMobile ? '9px 12px' : '10px 16px',
    borderRadius: 10,
    fontSize: isMobile ? 12 : 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: finalUrl ? 'pointer' : 'not-allowed',
    opacity: finalUrl ? 1 : 0.55,
    boxShadow: 'none',
    textDecoration: 'none',
    flexShrink: 0,
    transition: 'transform 0.18s ease, opacity 0.18s ease, border-color 0.18s ease',
    ...style
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={baseStyle}
      disabled={!finalUrl}
      aria-label={label}
      title={finalUrl ? label : 'Download unavailable'}
    >
      <span aria-hidden="true">⬇</span>
      <span>{label}</span>
    </button>
  )
}