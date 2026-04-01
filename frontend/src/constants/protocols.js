import { COLOURS } from "./colors";

export const PROTO_NAMES = { 
    1: 'ICMP', 
    2: 'IGMP', 
    6: 'TCP', 
    17: 'UDP', 
    41: 'IPv6', 
    89: 'OSPF' 
};

export const PROTO_COLOURS = {
  'TCP':  COLOURS.accentBlue,
  'UDP':  COLOURS.accentPurple,
  'IGMP': COLOURS.accentAmber,
  'ICMP': COLOURS.accentGreen,
  'IPv6': COLOURS.accentPink,
  'OSPF': COLOURS.accentOrange,
  'UNK':  '#64748b',
};