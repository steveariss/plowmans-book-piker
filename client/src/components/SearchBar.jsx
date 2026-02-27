import styles from './SearchBar.module.css';

export default function SearchBar({ value, onChange, placeholder = 'Search books...' }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>{'\uD83D\uDD0D'}</span>
      <input
        className={styles.input}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className={styles.clear}
          onClick={() => onChange('')}
          type="button"
          aria-label="Clear search"
        >
          {'\u2715'}
        </button>
      )}
    </div>
  );
}
