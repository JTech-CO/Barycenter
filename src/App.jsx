import styles from './App.module.css';

const milestones = [
  ['M1', '기반·계약', 'complete'],
  ['M2', '수치 코어', 'complete'],
  ['M3', '물리 검증', 'complete'],
  ['M4', 'CR3BP 분석', 'complete'],
  ['M5', '해석 도구', 'active'],
];

export default function App() {
  return (
    <main className={styles.shell}>
      <header className={styles.titlebar}>
        <span className={styles.mark} aria-hidden="true" />
        <strong>Barycenter</strong>
        <span className={styles.subtitle}>N-body analysis workspace</span>
      </header>

      <section className={styles.workspace} aria-labelledby="workspace-title">
        <div>
          <p className={styles.eyebrow}>IMPLEMENTATION BASELINE</p>
          <h1 id="workspace-title">결정론적 중력계의 정확한 출발점</h1>
          <p className={styles.lede}>
            코어와 인터페이스 경계를 먼저 고정하고, 해석해와 보존량으로 각
            구현 단계를 검증합니다.
          </p>
        </div>

        <ol className={styles.milestones} aria-label="개발 마일스톤">
          {milestones.map(([id, label, status]) => (
            <li key={id} data-status={status}>
              <span>{id}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.statusbar}>
        <span>UNITS: AU · yr · M☉</span>
        <span>G = 4π²</span>
        <span>ANALYSIS ALPHA · M5 NEXT</span>
      </footer>
    </main>
  );
}
