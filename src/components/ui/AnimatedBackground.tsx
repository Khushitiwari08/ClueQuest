import styles from './AnimatedBackground.module.css'

export default function AnimatedBackground() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <div className={`${styles.orb} ${styles.orb4}`} />
      <div className={styles.stars}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className={styles.star} style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            animationDelay: `${(i * 0.3) % 4}s`,
            animationDuration: `${2 + (i % 3)}s`,
            width: i % 5 === 0 ? '2px' : '1px',
            height: i % 5 === 0 ? '2px' : '1px',
          }} />
        ))}
      </div>
    </div>
  )
}
