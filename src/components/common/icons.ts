// Lightweight, tree-shakeable Lucide icon registry for CampusNotes
// Contains only the 64 icons verified in use across the application
// Reduces vendor icon payload by >600 kB by eliminating the CommonJS bundle fallback

import React, { forwardRef } from 'react';

export interface LucideProps extends React.SVGProps<SVGSVGElement> {
  color?: string;
  size?: string | number;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
}

export type LucideIcon = React.ForwardRefExoticComponent<
  LucideProps & React.RefAttributes<SVGSVGElement>
>;

export type IconNode = [elementName: string, attrs: Record<string, string>][];

function createLucideIcon(iconName: string, iconNode: IconNode): LucideIcon {
  const Component = forwardRef<SVGSVGElement, LucideProps>(
    ({ color = 'currentColor', size = 24, strokeWidth = 2, className = '', children, ...rest }, ref) => {
      return React.createElement(
        'svg',
        {
          ref,
          xmlns: 'http://www.w3.org/2000/svg',
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: color,
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className: `lucide lucide-${iconName}${className ? ' ' + className : ''}`,
          ...rest,
        },
        [
          ...iconNode.map(([tag, attrs], index) =>
            React.createElement(tag, { ...attrs, key: attrs.key || index })
          ),
          ...(Array.isArray(children) ? children : children ? [children] : []),
        ]
      );
    }
  );
  Component.displayName = iconName;
  return Component;
}

const Activity = /* @__PURE__ */ createLucideIcon('activity', [["path",{"d":"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2","key":"169zse"}]]);
const CircleAlert = /* @__PURE__ */ createLucideIcon('circle-alert', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12","key":"1pkeuh"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16","key":"4dfq90"}]]);
const TriangleAlert = /* @__PURE__ */ createLucideIcon('triangle-alert', [["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3","key":"wmoenq"}],["path",{"d":"M12 9v4","key":"juzpu7"}],["path",{"d":"M12 17h.01","key":"p32p05"}]]);
const ArrowLeft = /* @__PURE__ */ createLucideIcon('arrow-left', [["path",{"d":"m12 19-7-7 7-7","key":"1l729n"}],["path",{"d":"M19 12H5","key":"x3x0zl"}]]);
const ArrowRight = /* @__PURE__ */ createLucideIcon('arrow-right', [["path",{"d":"M5 12h14","key":"1ays0h"}],["path",{"d":"m12 5 7 7-7 7","key":"xquz4c"}]]);
const ArrowUpRight = /* @__PURE__ */ createLucideIcon('arrow-up-right', [["path",{"d":"M7 7h10v10","key":"1tivn9"}],["path",{"d":"M7 17 17 7","key":"1vkiza"}]]);
const ChartColumn = /* @__PURE__ */ createLucideIcon('chart-column', [["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16","key":"c24i48"}],["path",{"d":"M18 17V9","key":"2bz60n"}],["path",{"d":"M13 17V5","key":"1frdt8"}],["path",{"d":"M8 17v-3","key":"17ska0"}]]);
const BookOpen = /* @__PURE__ */ createLucideIcon('book-open', [["path",{"d":"M12 5v16","key":"1f6ucr"}],["path",{"d":"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z","key":"1fyvmf"}]]);
const Calendar = /* @__PURE__ */ createLucideIcon('calendar', [["path",{"d":"M8 2v3","key":"1ioesn"}],["path",{"d":"M16 2v3","key":"otl347"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2","key":"h1oib"}],["path",{"d":"M3 9h18","key":"1pudct"}]]);
const Check = /* @__PURE__ */ createLucideIcon('check', [["path",{"d":"M20 6 9 17l-5-5","key":"1gmf2c"}]]);
const CircleCheckBig = /* @__PURE__ */ createLucideIcon('circle-check-big', [["path",{"d":"M21.801 10A10 10 0 1 1 17 3.335","key":"yps3ct"}],["path",{"d":"m9 11 3 3L22 4","key":"1pflzl"}]]);
const CircleCheck = /* @__PURE__ */ createLucideIcon('circle-check', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"m16 9-5.5 5.5L8 12","key":"xofnsj"}]]);
const ChevronDown = /* @__PURE__ */ createLucideIcon('chevron-down', [["path",{"d":"m6 9 6 6 6-6","key":"qrunsl"}]]);
const ChevronUp = /* @__PURE__ */ createLucideIcon('chevron-up', [["path",{"d":"m18 15-6-6-6 6","key":"153udz"}]]);
const Clock = /* @__PURE__ */ createLucideIcon('clock', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M12 6v6l4 2","key":"mmk7yg"}]]);
const Compass = /* @__PURE__ */ createLucideIcon('compass', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z","key":"9ktpf1"}]]);
const Copy = /* @__PURE__ */ createLucideIcon('copy', [["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2","key":"17jyea"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2","key":"1eonqg"}]]);
const Database = /* @__PURE__ */ createLucideIcon('database', [["ellipse",{"cx":"12","cy":"5","rx":"9","ry":"3","key":"msslwz"}],["path",{"d":"M3 5V19A9 3 0 0 0 21 19V5","key":"1wlel7"}],["path",{"d":"M3 12A9 3 0 0 0 21 12","key":"mv7ke4"}]]);
const Download = /* @__PURE__ */ createLucideIcon('download', [["path",{"d":"M12 15V3","key":"m9g1x1"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","key":"ih7n3h"}],["path",{"d":"m7 10 5 5 5-5","key":"brsn70"}]]);
const CloudDownload = /* @__PURE__ */ createLucideIcon('cloud-download', [["path",{"d":"M12 13v8l-4-4","key":"1f5nwf"}],["path",{"d":"m12 21 4-4","key":"1lfcce"}],["path",{"d":"M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284","key":"ui1hmy"}]]);
const Pen = /* @__PURE__ */ createLucideIcon('pen', [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z","key":"1a8usu"}]]);
const ExternalLink = /* @__PURE__ */ createLucideIcon('external-link', [["path",{"d":"M15 3h6v6","key":"1q9fwt"}],["path",{"d":"M10 14 21 3","key":"gplh6r"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6","key":"a6xqqp"}]]);
const Eye = /* @__PURE__ */ createLucideIcon('eye', [["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0","key":"1nclc0"}],["circle",{"cx":"12","cy":"12","r":"3","key":"1v7zrd"}]]);
const FileCheck = /* @__PURE__ */ createLucideIcon('file-check', [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z","key":"1oefj6"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5","key":"wfsgrz"}],["path",{"d":"m9 15 2 2 4-4","key":"1grp1n"}]]);
const FileQuestionMark = /* @__PURE__ */ createLucideIcon('file-question-mark', [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z","key":"1oefj6"}],["path",{"d":"M12 17h.01","key":"p32p05"}],["path",{"d":"M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3","key":"mhlwft"}]]);
const FileText = /* @__PURE__ */ createLucideIcon('file-text', [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z","key":"1oefj6"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5","key":"wfsgrz"}],["path",{"d":"M10 9H8","key":"b1mrlr"}],["path",{"d":"M16 13H8","key":"t4e002"}],["path",{"d":"M16 17H8","key":"z1uh3a"}]]);
const Funnel = /* @__PURE__ */ createLucideIcon('funnel', [["path",{"d":"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z","key":"sc7q7i"}]]);
const FlaskConical = /* @__PURE__ */ createLucideIcon('flask-conical', [["path",{"d":"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2","key":"18mbvz"}],["path",{"d":"M6.453 15h11.094","key":"3shlmq"}],["path",{"d":"M8.5 2h7","key":"csnxdl"}]]);
const FolderOpen = /* @__PURE__ */ createLucideIcon('folder-open', [["path",{"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2","key":"usdka0"}]]);
const Globe = /* @__PURE__ */ createLucideIcon('globe', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20","key":"13o1zl"}],["path",{"d":"M2 12h20","key":"9i4pu4"}]]);
const GraduationCap = /* @__PURE__ */ createLucideIcon('graduation-cap', [["path",{"d":"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z","key":"j76jl0"}],["path",{"d":"M22 10v6","key":"1lu8f3"}],["path",{"d":"M6 12.5V16a6 3 0 0 0 12 0v-3.5","key":"1r8lef"}]]);
const HardDrive = /* @__PURE__ */ createLucideIcon('hard-drive', [["path",{"d":"M10 16h.01","key":"1bzywj"}],["path",{"d":"M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z","key":"18tbho"}],["path",{"d":"M21.946 12.013H2.054","key":"zqlbp7"}],["path",{"d":"M6 16h.01","key":"1pmjb7"}]]);
const Hash = /* @__PURE__ */ createLucideIcon('hash', [["line",{"x1":"4","x2":"20","y1":"9","y2":"9","key":"4lhtct"}],["line",{"x1":"4","x2":"20","y1":"15","y2":"15","key":"vyu0kd"}],["line",{"x1":"10","x2":"8","y1":"3","y2":"21","key":"1ggp8o"}],["line",{"x1":"16","x2":"14","y1":"3","y2":"21","key":"weycgp"}]]);
const HeartPulse = /* @__PURE__ */ createLucideIcon('heart-pulse', [["path",{"d":"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5","key":"mvr1a0"}],["path",{"d":"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27","key":"auskq0"}]]);
const CircleQuestionMark = /* @__PURE__ */ createLucideIcon('circle-question-mark', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3","key":"1u773s"}],["path",{"d":"M12 17h.01","key":"p32p05"}]]);
const RotateCcwClock = /* @__PURE__ */ createLucideIcon('rotate-ccw-clock', [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","key":"1357e3"}],["path",{"d":"M3 3v5h5","key":"1xhq8a"}],["path",{"d":"M12 7v5l4 2","key":"1fdv2h"}]]);
const House = /* @__PURE__ */ createLucideIcon('house', [["path",{"d":"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8","key":"5wwlr5"}],["path",{"d":"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","key":"r6nss1"}]]);
const Info = /* @__PURE__ */ createLucideIcon('info', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M12 16v-4","key":"1dtifu"}],["path",{"d":"M12 8h.01","key":"e9boi3"}]]);
const Key = /* @__PURE__ */ createLucideIcon('key', [["path",{"d":"m2 21 9.6-9.6","key":"9l79m3"}],["path",{"d":"m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19","key":"fw8biw"}],["circle",{"cx":"15.5","cy":"7.5","r":"5.5","key":"4wxmhb"}]]);
const Laptop = /* @__PURE__ */ createLucideIcon('laptop', [["path",{"d":"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z","key":"1pdavp"}],["path",{"d":"M20.054 15.987H3.946","key":"14rxg9"}]]);
const Layers = /* @__PURE__ */ createLucideIcon('layers', [["path",{"d":"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z","key":"zw3jo"}],["path",{"d":"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12","key":"1wduqc"}],["path",{"d":"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17","key":"kqbvx6"}]]);
const LayoutDashboard = /* @__PURE__ */ createLucideIcon('layout-dashboard', [["rect",{"width":"7","height":"9","x":"3","y":"3","rx":"1","key":"10lvy0"}],["rect",{"width":"7","height":"5","x":"14","y":"3","rx":"1","key":"16une8"}],["rect",{"width":"7","height":"9","x":"14","y":"12","rx":"1","key":"1hutg5"}],["rect",{"width":"7","height":"5","x":"3","y":"16","rx":"1","key":"ldoo1y"}]]);
const Lock = /* @__PURE__ */ createLucideIcon('lock', [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2","key":"1w4ew1"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4","key":"fwvmzm"}]]);
const LogOut = /* @__PURE__ */ createLucideIcon('log-out', [["path",{"d":"m16 17 5-5-5-5","key":"1bji2h"}],["path",{"d":"M21 12H9","key":"dn1m92"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","key":"1uf3rs"}]]);
const Menu = /* @__PURE__ */ createLucideIcon('menu', [["path",{"d":"M4 5h16","key":"1tepv9"}],["path",{"d":"M4 12h16","key":"1lakjw"}],["path",{"d":"M4 19h16","key":"1djgab"}]]);
const Plus = /* @__PURE__ */ createLucideIcon('plus', [["path",{"d":"M5 12h14","key":"1ays0h"}],["path",{"d":"M12 5v14","key":"s699le"}]]);
const RefreshCw = /* @__PURE__ */ createLucideIcon('refresh-cw', [["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8","key":"v9h5vc"}],["path",{"d":"M21 3v5h-5","key":"1q7to0"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16","key":"3uifl3"}],["path",{"d":"M8 16H3v5","key":"1cv678"}]]);
const RotateCcw = /* @__PURE__ */ createLucideIcon('rotate-ccw', [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","key":"1357e3"}],["path",{"d":"M3 3v5h5","key":"1xhq8a"}]]);
const Search = /* @__PURE__ */ createLucideIcon('search', [["path",{"d":"m21 21-4.34-4.34","key":"14j7rj"}],["circle",{"cx":"11","cy":"11","r":"8","key":"4ej97u"}]]);
const Share2 = /* @__PURE__ */ createLucideIcon('share-2', [["circle",{"cx":"18","cy":"5","r":"3","key":"gq8acd"}],["circle",{"cx":"6","cy":"12","r":"3","key":"w7nqdw"}],["circle",{"cx":"18","cy":"19","r":"3","key":"1xt0gg"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49","key":"47mynk"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49","key":"1n3mei"}]]);
const ShieldCheck = /* @__PURE__ */ createLucideIcon('shield-check', [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z","key":"oel41y"}],["path",{"d":"m9 12 2 2 4-4","key":"dzmm74"}]]);
const Smartphone = /* @__PURE__ */ createLucideIcon('smartphone', [["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2","key":"1yt0o3"}],["path",{"d":"M12 18h.01","key":"mhygvu"}]]);
const Sparkles = /* @__PURE__ */ createLucideIcon('sparkles', [["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z","key":"1s2grr"}],["path",{"d":"M20 2v4","key":"1rf3ol"}],["path",{"d":"M22 4h-4","key":"gwowj6"}],["circle",{"cx":"4","cy":"20","r":"2","key":"6kqj1y"}]]);
const Tablet = /* @__PURE__ */ createLucideIcon('tablet', [["rect",{"width":"16","height":"20","x":"4","y":"2","rx":"2","ry":"2","key":"76otgf"}],["line",{"x1":"12","x2":"12.01","y1":"18","y2":"18","key":"1dp563"}]]);
const Tag = /* @__PURE__ */ createLucideIcon('tag', [["path",{"d":"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z","key":"vktsd0"}],["circle",{"cx":"7.5","cy":"7.5","r":".5","fill":"currentColor","key":"kqv944"}]]);
const Trash = /* @__PURE__ */ createLucideIcon('trash', [["path",{"d":"M10 11v6","key":"nco0om"}],["path",{"d":"M14 11v6","key":"outv1u"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6","key":"miytrc"}],["path",{"d":"M3 6h18","key":"d0wm0j"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2","key":"e791ji"}]]);
const Upload = /* @__PURE__ */ createLucideIcon('upload', [["path",{"d":"M12 3v12","key":"1x0j5s"}],["path",{"d":"m17 8-5-5-5 5","key":"7q97r8"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","key":"ih7n3h"}]]);
const User = /* @__PURE__ */ createLucideIcon('user', [["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2","key":"975kel"}],["circle",{"cx":"12","cy":"7","r":"4","key":"17ys0d"}]]);
const Users = /* @__PURE__ */ createLucideIcon('users', [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","key":"1yyitq"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744","key":"16gr8j"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87","key":"kshegd"}],["circle",{"cx":"9","cy":"7","r":"4","key":"nufk8"}]]);
const Wifi = /* @__PURE__ */ createLucideIcon('wifi', [["path",{"d":"M12 20h.01","key":"zekei9"}],["path",{"d":"M2 8.82a15 15 0 0 1 20 0","key":"dnpr2z"}],["path",{"d":"M5 12.859a10 10 0 0 1 14 0","key":"1x1e6c"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0","key":"1bycff"}]]);
const WifiOff = /* @__PURE__ */ createLucideIcon('wifi-off', [["path",{"d":"M12 20h.01","key":"zekei9"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0","key":"1bycff"}],["path",{"d":"M5 12.859a10 10 0 0 1 5.17-2.69","key":"1dl1wf"}],["path",{"d":"M19 12.859a10 10 0 0 0-2.007-1.523","key":"4k23kn"}],["path",{"d":"M2 8.82a15 15 0 0 1 4.177-2.643","key":"1grhjp"}],["path",{"d":"M22 8.82a15 15 0 0 0-11.288-3.764","key":"z3jwby"}],["path",{"d":"m2 2 20 20","key":"1ooewy"}]]);
const Wrench = /* @__PURE__ */ createLucideIcon('wrench', [["path",{"d":"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z","key":"1ngwbx"}]]);
const X = /* @__PURE__ */ createLucideIcon('x', [["path",{"d":"M18 6 6 18","key":"1bl5f8"}],["path",{"d":"m6 6 12 12","key":"d8bk6v"}]]);
const CircleX = /* @__PURE__ */ createLucideIcon('circle-x', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"m15 9-6 6","key":"1uzhvr"}],["path",{"d":"m9 9 6 6","key":"z0biqf"}]]);
const Zap = /* @__PURE__ */ createLucideIcon('zap', [["path",{"d":"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z","key":"1v7up4"}]]);
const Ban = /* @__PURE__ */ createLucideIcon('ban', [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"m4.9 4.9 14.2 14.2","key":"1m5hkf"}]]);
const Mail = /* @__PURE__ */ createLucideIcon('mail', [["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2","key":"18nhru"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7","key":"1ocrg3"}]]);
const MessageCircle = /* @__PURE__ */ createLucideIcon('message-circle', [["path",{"d":"M7.9 20A9 9 0 1 0 4 16.1L2 22Z","key":"vv11sd"}]]);
const Image = /* @__PURE__ */ createLucideIcon('image', [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2","key":"1m30ak"}],["circle",{"cx":"9","cy":"9","r":"2","key":"af1f0g"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21","key":"1xmnt7"}]]);
const FileArchive = /* @__PURE__ */ createLucideIcon('file-archive', [["path",{"d":"M10 12v-1","key":"17s927"}],["path",{"d":"M10 18v-2","key":"16757x"}],["path",{"d":"M10 7V6","key":"18l98e"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"120689"}],["path",{"d":"M15.5 22H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10l6 6v10a2 2 0 0 1-2 2h-2.5","key":"2j275u"}],["circle",{"cx":"10","cy":"20","r":"2","key":"13v4t6"}]]);
const FileSpreadsheet = /* @__PURE__ */ createLucideIcon('file-spreadsheet', [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"19oxwf"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"120689"}],["path",{"d":"M8 13h2","key":"1d7x6q"}],["path",{"d":"M14 13h2","key":"151c7l"}],["path",{"d":"M8 17h2","key":"1ox01g"}],["path",{"d":"M14 17h2","key":"4e8o4l"}]]);
const Presentation = /* @__PURE__ */ createLucideIcon('presentation', [["path",{"d":"M2 3h20","key":"91anec"}],["path",{"d":"M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3","key":"yuxw41"}],["path",{"d":"m7 21 5-5 5 5","key":"16v182"}]]);

// Export all icons matching project imports:
export {
  Activity,
  CircleAlert as AlertCircle,
  TriangleAlert as AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  ChartColumn as BarChart3,
  BookOpen,
  Calendar,
  Check,
  CircleCheckBig as CheckCircle,
  CircleCheck as CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  Database,
  Download,
  CloudDownload as DownloadCloud,
  Pen as Edit2,
  ExternalLink,
  Eye,
  FileArchive,
  FileCheck,
  FileQuestionMark as FileQuestion,
  FileSpreadsheet,
  FileText,
  Funnel as Filter,
  FlaskConical,
  FolderOpen,
  Globe,
  GraduationCap,
  HardDrive,
  Hash,
  HeartPulse,
  CircleQuestionMark as HelpCircle,
  RotateCcwClock as History,
  House as Home,
  Image,
  Info,
  Key,
  Laptop,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Tag,
  Trash as Trash2,
  Upload,
  User,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X,
  CircleX as XCircle,
  Zap,
};
