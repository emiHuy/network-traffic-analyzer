/**
 * @file ProtoBadge.jsx
 * @description Renders a coloured protocol badge for a given protocol number or name.
 *
 * Props:
 *   @prop {number|string} protocol - Protocol number (e.g. 6) or name (e.g. 'TCP').
 *                                    Falls back to 'UNK' if unrecognised or omitted.
 */

import { PROTO_NAMES, PROTO_COLOURS } from '../../constants/protocols';
import styles from './ProtoBadge.module.css';

export default function ProtoBadge({ protocol }) {
  // Resolve protocol number to name, or use string directly
  const name = typeof protocol === 'number'
    ? (PROTO_NAMES[protocol] ?? 'UNK')
    : (protocol ?? 'UNK');
  const colour = PROTO_COLOURS[name] ?? PROTO_COLOURS['UNK'];
  return (
    <span
      className={styles.badge}
      // 1a suffix = 10% opacity background tint
      style={{ color: colour, background: `${colour}1a` }}
    >
      {name}
    </span>
  );
}