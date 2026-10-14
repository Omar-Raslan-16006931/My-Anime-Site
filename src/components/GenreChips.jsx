import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { normalizeGenres, categoryPath } from '../lib/categories'

// A show's categories as one clean line of text, separated by dots
// ("Action · Drama · Fantasy"). Each name links to its category page.
export default function GenreChips({ genres, className = '' }) {
  const list = normalizeGenres(genres)
  if (!list.length) return null
  return (
    <div className={'genre-line ' + className}>
      {list.map((g, i) => (
        <Fragment key={g}>
          {i > 0 && <span className="genre-dot" aria-hidden="true">·</span>}
          <Link to={categoryPath(g)} className="genre-link">{g}</Link>
        </Fragment>
      ))}
    </div>
  )
}
