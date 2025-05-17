import styles from '../styles/base/HomeView.module.css';
import { useAppStore } from '../store/appStore';

export default function HomeView() {
  const { setView } = useAppStore();

  return (
    <div className={styles.homeContainer}>
      <img src="/images/LOGO-LK-noir_2025.png" alt="LK Invest Logo" className={styles.logo} />

      <div className={styles.subtitle} style={{ fontWeight: 700, fontSize: '1.2rem' }}>MAISON FARNIENTE</div>
      <div className={styles.buttonGroup}>
        <button className={styles.button} onClick={() => setView('projects')}>Voir les projets</button>
        <button className={styles.button} onClick={() => setView('create-project')}>Nouvelle estimation</button>
      </div>
    </div>
  );
} 