import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import styles from '../styles/ProtocolBreakdown.module.css';

// accent colors assigned to protocols in order
const COLORS = ["#4fc3f7", "#a78bfa", "#f59e0b", "#22c55e", "#ef4444", "#94a3b8"];

// custom tooltip shown on slice hover
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.customTooltip}>
      {payload[0].name}: {payload[0].value}
    </div>
  );
};

export default function ProtocolBreakdown({ data = [] }) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  // add fill color to each slice
  const dataWithColors = data.map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className={styles.panel}>
      <div className={styles.title}>protocol breakdown</div>

      {data.length === 0 ? (
        <div className={styles.empty}>no data yet</div>
      ) : (
        <div className={styles.wrap}>
          {/* donut chart — innerRadius creates the hole */}
          <ResponsiveContainer width={110} height={110}>
            <PieChart>
              <Pie
                data={dataWithColors}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={50}
                dataKey="total"
                nameKey="protocol"
                strokeWidth={0}
              />
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className={styles.legend}>
            {/* one row per protocol */}
            {data.map((row, i) => (
              <div key={row.protocol} className={styles.legendItem}>
                {/* dot color matches pie slice — set inline */}
                <div className={styles.dot} style={{ background: COLORS[i % COLORS.length] }} />
                <span>{row.protocol}</span>
                <span className={styles.val}>{row.total}</span>
              </div>
            ))}

            {/* total row with top border divider */}
            <div className={`${styles.legendItem} ${styles.legendItemTotal}`}>
              <span style={{ color: "#546e8a" }}>total</span>
              <span className={styles.val}>{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}