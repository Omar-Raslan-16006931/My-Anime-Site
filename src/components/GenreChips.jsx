import { Link } from 'react-router-dom'
import { normalizeGenres, categoryPath } from '../lib/categories'

// A show's categories, each one a link to that category's page.
export default function GenreChips({ genres, className = '' }) {
  const list = normalizeGenres(genres)
  if (!list.length) return null
  return (
    <div className={'genre-chips ' + className}>
      {list.map((g) => (
        <Link key={g} to={categoryPath(g)} className="genre-chip">{g}</Link>
      ))}
    </div>
  )
}
