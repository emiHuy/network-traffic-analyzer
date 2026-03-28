import styles from './NavBar.module.css';

const TAB_INDICATORS = {
    dashboard: '#22c55e',  // green — capturing
    network:   '#f59e0b',  // amber — passive sniffer
    alerts:    '#f45757',
    analysis:  '#c699d6',
};

export default function NavBar( { activeView, onViewChange, isCapturing, sessionId, numAlerts }) {
    return (
        <div className={styles.bar}>
            <div className={styles.buttons}>
                <button
                    className={`${styles.tab} ${activeView === 'dashboard' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('dashboard')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.dashboard,
                            animation: isCapturing ? 'navPulse 1.5s infinite' : 'none',
                            opacity: isCapturing ? 1 : 0.3,
                        }}
                    />
                    dashboard
                </button>

                <button
                    className={`${styles.tab} ${activeView === 'network' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('network')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.network,
                            // amber dot always slightly visible — sniffer is always available
                            opacity: 0.6,
                        }}
                    />
                    network
                </button>

                <button
                    className={`${styles.tab} ${activeView === 'alerts' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('alerts')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.alerts,
                            // amber dot always slightly visible — sniffer is always available
                            opacity: 0.6,
                        }}
                    />
                    alerts
                </button>

                <button
                    className={`${styles.tab} ${activeView === 'analysis' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('analysis')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.analysis,
                            // amber dot always slightly visible — sniffer is always available
                            opacity: 0.6,
                        }}
                    />
                    ai analysis
                </button>

            </div>
            { numAlerts > 0 ? (
                <span className={styles.countBadge}>{numAlerts} alert{numAlerts !== 1 ? 's' : ''}</span>) : ('')
            }
        </div>
    );
}