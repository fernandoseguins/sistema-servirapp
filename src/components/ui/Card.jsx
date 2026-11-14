export default function Card({ as: Tag = 'div', padded = true, className = '', children, ...props }) {
  return (
    <Tag className={`bg-surface border border-line rounded-card ${padded ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
