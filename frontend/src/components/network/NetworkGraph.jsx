/**
 * @file NetworkGraph.jsx
 * @description Interactive network topology visualization showing devices and router connections.
 *
 * Props:
 *   @prop {object[]} nodes          - Array of device objects { ip, mac, manufacturer, bytes_seen, packet_count, last_seen }.
 *   @prop {boolean} isVisible       - Whether the network graph panel is visible.
 *   @prop {boolean} isCapturing     - Whether live capture is currently active.
 *   @prop {Function} onScan         - Callback to initiate a network scan.
 *   @prop {boolean} scanning        - Whether a scan is currently in progress.
 *   @prop {string|Date} lastScanTime- Timestamp of the last completed scan.
 *   @prop {boolean} sessionHasData  - Whether the current session already contains captured data.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatBytes, formatSince } from '../../utils/format';
import { COLOURS } from '../../constants/colors';
import styles from './NetworkGraph.module.css';

// ── helpers ───────────────────────────────────────────────────────────────────

// Returns node color for live capture state.
function nodeColor(device) {
    const ago = secondsSince(device.last_seen);
    if (ago < 30)  return COLOURS.accentGreen;
    if (ago < 300) return COLOURS.accentAmber;
    return COLOURS.nodeIdle;
}

// Returns node color after capture based on bytes seen.
function postCaptureColor(device, maxBytes) {
    if (maxBytes === 0 || !device.bytes_seen) return COLOURS.nodeIdle;
    const ratio = device.bytes_seen / maxBytes;
    if (ratio >= 0.5) return COLOURS.accentGreen;
    if (ratio >= 0.2) return COLOURS.accentAmber;
    return COLOURS.nodeLow;
}

/** Returns seconds elapsed since ISO timestamp. */
function secondsSince(isoString) {
    if (!isoString) return 9999;
    return (Date.now() - new Date(isoString).getTime()) / 1000;
}

/** Determines if a device is a router based on IP or manufacturer. */
function isRouter(device) {
    const m = (device.manufacturer || '').toLowerCase();
    return (
        device.ip?.endsWith('.1') ||
        m.includes('netgear') ||
        m.includes('cisco') ||
        m.includes('asus') ||
        m.includes('tp-link') ||
        m.includes('ubiquiti')
    );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function NetworkGraph({ nodes = [], isVisible, isCapturing, onScan, scanning, lastScanTime, sessionHasData }) {
    const canvasRef  = useRef(null);
    const rafRef     = useRef(null);
    const tickRef    = useRef(0);
    const nodesRef   = useRef([]);           // positioned nodes (includes x, y)
    const [tooltip, setTooltip] = useState(null); // { x, y, device }

    // ── layout: place router at centre, devices on ring ───────────────────────
    const layoutNodes = useCallback((devices, W, H) => {
        if (!devices.length) return [];

        const cx = W / 2;
        const cy = H / 2;
        const orbitR = Math.min(W, H) * 0.36;

        const router = devices.find(isRouter) || devices[0];
        const spoke  = devices.filter(d => d !== router);

        return [
            { ...router, x: cx, y: cy, isRouter: true },
            ...spoke.map((d, i) => {
                const angle = (2 * Math.PI * i / spoke.length) - Math.PI / 2;
                return {
                    ...d,
                    x: cx + orbitR * Math.cos(angle),
                    y: cy + orbitR * Math.sin(angle),
                    isRouter: false,
                };
            }),
        ];
    }, []);

    // ── node sizing ───────────────────────────────────────────────────────────
    function getRadius(device, maxBytes) {
        if (device.isRouter) return 28;
        if (maxBytes === 0)  return 10;
        return 10 + 18 * Math.sqrt(device.bytes_seen / maxBytes);
    }

    // ── draw loop ─────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        const positioned = nodesRef.current;

        tickRef.current++;
        const tick = tickRef.current;

        ctx.clearRect(0, 0, W, H);

        if (!positioned.length) {
            // empty state
            ctx.fillStyle = COLOURS.textMuted;
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('no devices found — hit scan to discover your network', W / 2, H / 2);
            rafRef.current = requestAnimationFrame(draw);
            return;
        }

        const maxBytes = Math.max(...positioned.map(d => d.bytes_seen || 0));
        const router   = positioned.find(d => d.isRouter) || positioned[0];

        // draw edges
        positioned.filter(d => !d.isRouter).forEach(d => {
            const color = isCapturing
                ? nodeColor(d)
                : postCaptureColor(d, maxBytes);
            const edgeW = 0.5 + 3.5 * (maxBytes > 0 ? Math.sqrt((d.bytes_seen || 0) / maxBytes) : 0.1);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(router.x, router.y);
            ctx.lineTo(d.x, d.y);
            ctx.strokeStyle = color + '55';
            ctx.lineWidth   = edgeW;
            ctx.lineCap     = 'round';

            if (isCapturing && secondsSince(d.last_seen) < 30) {
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -(tick * 0.5);
            } else {
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.restore();
        });

        // draw nodes
        positioned.forEach(d => {
            const r     = getRadius(d, maxBytes);
            const color = isCapturing
                ? nodeColor(d)
                : postCaptureColor(d, maxBytes);

            // pulse ring for active nodes during capture
            if (isCapturing && secondsSince(d.last_seen) < 30) {
                const pulse = 0.5 + 0.5 * Math.sin(tick * 0.06 + (d.mac?.charCodeAt(0) || 0));
                ctx.beginPath();
                ctx.arc(d.x, d.y, r + 4 + pulse * 5, 0, 2 * Math.PI);
                ctx.fillStyle = color + '18';
                ctx.fill();
            }

            // node circle
            ctx.beginPath();
            ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
            ctx.fillStyle   = color + '2a';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth   = d.isRouter ? 2 : 1.5;
            ctx.setLineDash([]);
            ctx.stroke();

            // label inside node
            ctx.fillStyle = color;
            const fs = d.isRouter ? 10 : Math.max(8, Math.round(r * 0.5));
            ctx.font          = `500 ${fs}px monospace`;
            ctx.textAlign     = 'center';
            ctx.textBaseline  = 'middle';
            ctx.fillText(
                d.isRouter ? 'router' : '.' + (d.ip?.split('.')[3] ?? '?'),
                d.x, d.y
            );
        });

        rafRef.current = requestAnimationFrame(draw);
    }, [isCapturing]);

    // ── resize + re-layout when nodes change ──────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const wrap = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const W = wrap.offsetWidth;
        const H = Math.min(W * 0.58, 420);
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        // scale all drawing operations to match DPR
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        nodesRef.current = layoutNodes(nodes, W, H);
    }, [nodes, layoutNodes, isVisible]);

    // ── animation loop ────────────────────────────────────────────────────────
    useEffect(() => {
        rafRef.current = requestAnimationFrame(draw);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [draw]);

    // ── tooltip hit testing ───────────────────────────────────────────────────
    function getHitNode(mx, my) {
        const canvas  = canvasRef.current;
        if (!canvas) return null;
        const maxBytes = Math.max(...nodesRef.current.map(d => d.bytes_seen || 0));
        return nodesRef.current.find(d => {
            const r  = getRadius(d, maxBytes);
            const dx = d.x - mx;
            const dy = d.y - my;
            return Math.sqrt(dx * dx + dy * dy) < r + 6;
        }) ?? null;
    }

    function handleMouseMove(e) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx   = e.clientX - rect.left;
        const my   = e.clientY - rect.top;
        const node = getHitNode(mx, my);
        if (node) {
            canvas.style.cursor = 'pointer';
            setTooltip({ x: mx, y: my, device: node });
        } else {
            canvas.style.cursor = 'default';
            setTooltip(null);
        }
    }

    function handleMouseLeave() {
        setTooltip(null);
    }

    // ── last scan label ───────────────────────────────────────────────────────
    const lastScanLabel = lastScanTime
        ? `last scan: ${formatSince(new Date(lastScanTime).toISOString())}`
        : 'not yet scanned';

    return (
        <div className={styles.panel} style={{ display: isVisible ? '' : 'none' }}>
            {/* header */}
            <div className={styles.header}>
                <span className={styles.title}>
                    network map
                    {nodes.length > 0 && (
                        <span className={styles.subnet}>
                            · {nodes[0]?.ip?.split('.').slice(0, 3).join('.')}.0/24
                        </span>
                    )}
                </span>
                <div className={styles.headerRight}>
                    {isCapturing && (
                        <span className={styles.snifferBadge}>
                            <span className={styles.snifferDot} />
                            passive sniffer active
                        </span>
                    )}
                    <button
                        className={`${styles.scanBtn} ${scanning || isCapturing || sessionHasData ? styles.scanBtnDisabled : ''}`}
                        onClick={onScan}
                        disabled={scanning || isCapturing || sessionHasData}
                    >
                        {scanning ? '⟳ scanning…' : '⟳ scan'}
                    </button>
                </div>
            </div>

            {/* canvas */}
            <div className={styles.canvasWrap}>
                <canvas
                    ref={canvasRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                />

                {/* tooltip */}
                {tooltip && (
                    <div
                        className={styles.tooltip}
                        style={{
                            left: tooltip.x + 14,
                            top:  tooltip.y - 10,
                        }}
                    >
                        <div className={styles.tooltipIp}>{tooltip.device.ip}</div>
                        <div className={styles.tooltipMuted}>{tooltip.device.manufacturer}</div>
                        <div className={styles.tooltipMuted}>{tooltip.device.mac}</div>
                        <div className={styles.tooltipStats}>
                            {formatBytes(tooltip.device.bytes_seen || 0)}
                            {' · '}
                            {isCapturing
                                ? `seen ${formatSince(tooltip.device.last_seen)}`
                                : `${tooltip.device.packet_count || 0} packets total`
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* info bar */}
            <div className={styles.infoBar}>
                <div className={styles.legend}>
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLOURS.accentGreen }} />
                        {isCapturing ? 'active <30s' : 'high traffic'}
                    </span>
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLOURS.accentAmber }} />
                        {isCapturing ? 'recent <5min' : 'medium traffic'}
                    </span>
                    {!isCapturing && <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLOURS.nodeLow }} />
                        low traffic
                    </span>}
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLOURS.nodeIdle }} />
                        idle
                    </span>
                </div>
            <div className={styles.infoFooter}>
                <span className={styles.legendMuted}>
                    {isCapturing ? 'edge thickness = current traffic' : 'node size = session total'} · internal traffic counted for both sender and receiver
                </span>
                <span className={styles.lastScan}>{lastScanLabel}</span>
            </div>
            </div>
        </div>
    );
}
