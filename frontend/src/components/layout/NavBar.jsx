/**
 * @file NavBar.jsx
 * @description Top navigation bar for switching between main views.
 *
 * Provides tab-based navigation across:
 *   - Dashboard (live capture + metrics)
 *   - Network (topology view)
 *   - Alerts (anomaly list)
 *   - AI Analysis (Gemini-powered insights)
 *
 * Each tab includes a colored indicator reflecting its role/state.
 * The dashboard indicator animates while capture is active.
 *
 * Props:
 *   @prop {string}   activeView   - Currently selected view key.
 *   @prop {Function} onViewChange - Callback to switch views.
 *   @prop {boolean}  isCapturing  - Whether live capture is active (drives animation).
 *   @prop {number}   sessionId    - Current session ID (reserved for future use).
 *   @prop {number}   numAlerts    - Number of active alerts (shown as badge).
 */

import { COLOURS  } from '../../constants/colors';
import styles from './NavBar.module.css';

// accent colors for tab indicators (by view)
const TAB_INDICATORS = {
    dashboard: COLOURS.accentGreen,  // green — capturing
    network:   COLOURS.accentAmber,  // amber — passive sniffer
    alerts:    COLOURS.accentRed,
    analysis:  COLOURS.accentPurple,
};

export default function NavBar( { activeView, onViewChange, isCapturing, sessionId, numAlerts }) {
    return (
        <div className={styles.bar}>
            <div className={styles.buttons}>
                {/* Dashboard tab — animated when capture is active */}
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

                {/* Network tab — passive monitoring */}
                <button
                    className={`${styles.tab} ${activeView === 'network' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('network')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.network,
                            opacity: 0.6,
                        }}
                    />
                    network
                </button>

                {/* Alerts tab — anomaly monitoring */}
                <button
                    className={`${styles.tab} ${activeView === 'alerts' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('alerts')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.alerts,
                            opacity: 0.6,
                        }}
                    />
                    alerts
                </button>

                {/* AI Analysis tab — Gemini-powered insights */}
                <button
                    className={`${styles.tab} ${activeView === 'analysis' ? styles.tabActive : ''}`}
                    onClick={() => onViewChange('analysis')}
                >
                    <span
                        className={styles.indicator}
                        style={{
                            background: TAB_INDICATORS.analysis,
                            opacity: 0.6,
                        }}
                    />
                    ai analysis
                </button>

            </div>
            
            {/* alert count badge (only shown when alerts exist) */}
            { numAlerts > 0 ? (
                <span className={styles.countBadge}>{numAlerts} alert{numAlerts !== 1 ? 's' : ''}</span>) : ('')
            }
        </div>
    );
}