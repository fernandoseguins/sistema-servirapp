export default function Card({ as = 'div', padded = true, className = '', children, ...props }) {
  const Tag = as
  return (
    <Tag className={`bg-surface border border-line rounded-card ${padded ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
