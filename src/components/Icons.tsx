
import React from 'react';
import { Play, BookOpen, Headphones, Film, Share2, X, ChevronLeft, ChevronRight, Camera, Heart, Eye, EyeOff, LayoutGrid, Link as LinkIcon, Check, Twitter, MessageCircle, Instagram, Download, SlidersHorizontal, ChevronDown, ChevronUp, ShoppingBag, List, ArrowUpDown, ArrowUp, ArrowDown, Copy, Trash, Plus, Sun, Moon, GraduationCap, Coffee, MoreHorizontal, Mail, Info, Settings, User, Users, Music, Image, ExternalLink, Palette, Package, Lightbulb, Send, Sparkles, MapPin, Search, ZoomIn, Star, Home, Calendar, LogOut, LogIn, Shield, Clock, KeyRound, AlertCircle, Pencil } from 'lucide-react';

export const SealIcon = ({ className, style, ...props }: { className?: string, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" className={className} style={style} fill="currentColor" {...props}>
    <rect x="10" y="10" width="80" height="80" rx="5" fill="currentColor" />
    <path d="M30 30 L70 30 M30 50 L70 50 M30 70 L70 70" stroke="currentColor" strokeWidth="4" />
    <path d="M50 20 L50 80" stroke="currentColor" strokeWidth="4" />
  </svg>
);

export const TeaLeafIcon = ({ className, filled, style, ...props }: { className?: string, filled?: boolean, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path
      d="M12 20.5C12 20.5 5 16 4 10C3 4 9 2 12 4C15 2 21 4 20 10C19 16 12 20.5 12 20.5Z"
      fill={filled ? "currentColor" : "none"}
    />
    <path d="M12 20.5V8" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
    <path d="M12 8L8 5" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
    <path d="M12 8L16 5" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
  </svg>
);

export const TeapotIcon = ({ className, style, ...props }: { className?: string, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 13a3 3 0 0 1 3 3v2a1 1 0 0 1-1 1h-1" />
    <path d="M4 13a3 3 0 0 0-3 3v2a1 1 0 0 0 1 1h1" />
    <path d="M20 19H4a2 2 0 0 1-2-2v-4a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v4a2 2 0 0 1-2 2z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </svg>
);

export const OfferingsIcon = ({ className, filled, style, ...props }: { className?: string, filled?: boolean, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <g>
      <path d="M13 8.5h4v1.2c0 1.2-0.9 2.1-2 2.1s-2-0.9-2-2.1V8.5Z" fill={filled ? "currentColor" : "none"} />
      <path d="M12.4 12.5h5.2" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M14 6.5c0.6-0.5 0.6-1.3 0-1.8" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M16 6.5c0.6-0.5 0.6-1.3 0-1.8" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M5 13.8c1.1 0.4 2.1 0.6 3.1 0.6H11c0.7 0 1.2 0.3 1.6 0.7l1.1 1.1c0.4 0.4 0.2 1.1-0.3 1.3-1.7 0.7-3.3 1-5.1 1-1.1 0-1.9-0.2-2.7-0.5-0.8-0.3-1.6-0.8-2.1-1.4" fill={filled ? "currentColor" : "none"} />
    </g>
  </svg>
);

export const LearnIcon = ({ className, filled, style, ...props }: { className?: string, filled?: boolean, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <g>
      <path d="M8 5.5H16C16.83 5.5 17.5 6.17 17.5 7v11H9C7.62 18 6.5 18.5 6.5 18.5V7C6.5 6.17 7.17 5.5 8 5.5Z" fill={filled ? "currentColor" : "none"} />
      <path d="M8 5.5V17.5" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M12.5 9.5c1.1 0 2 .9 2 2 0 1.6-1.15 2.9-3.2 3.6" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M12.5 9.5c-0.7 0.4-1.4 1.2-1.7 2.3" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
    </g>
  </svg>
);

export const MagazineIcon = ({ className, filled, style, ...props }: { className?: string, filled?: boolean, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <g>
      <path d="M5 6.5C7.5 6 9.5 6 12 7v10c-2.5-1-4.5-1-7 0V6.5Z" fill={filled ? "currentColor" : "none"} />
      <path d="M19 6.5C16.5 6 14.5 6 12 7v10c2.5-1 4.5-1 7 0V6.5Z" fill={filled ? "currentColor" : "none"} />
      <line x1="12" y1="7" x2="12" y2="17" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <line x1="7" y1="9" x2="10" y2="9" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <line x1="7" y1="11" x2="10" y2="11" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <circle cx="15.5" cy="10" r="1.1" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} fill={filled ? "rgba(255,255,255,0.3)" : "none"} />
      <line x1="14.3" y1="12.5" x2="16.7" y2="12.5" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
    </g>
  </svg>
);

export const ShopIcon = ({ className, filled, style, ...props }: { className?: string, filled?: boolean, style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <g>
      <rect x="9" y="6" width="6" height="1.6" rx="0.5" fill={filled ? "currentColor" : "none"} />
      <path d="M10 7.6h4" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
      <path d="M8.5 7.6C7.7 8.3 7.2 9.5 7.2 10.8v4.3c0 2 1.7 3.7 3.7 3.7h2.2c2 0 3.7-1.7 3.7-3.7v-4.3c0-1.3-0.5-2.5-1.3-3.2" fill={filled ? "currentColor" : "none"} />
      <path d="M8.7 12.1h6.6" stroke={filled ? "rgba(255,255,255,0.5)" : "currentColor"} />
    </g>
  </svg>
);

export const Icons = {
  Play,
  Book: BookOpen,
  Audio: Headphones,
  Film,
  Share: Share2,
  Close: X,
  Back: ChevronLeft,
  ChevronLeft,
  Next: ChevronRight,
  ChevronRight,
  Seal: SealIcon,
  Leaf: TeaLeafIcon,
  Teapot: TeapotIcon,
  Offerings: OfferingsIcon,
  Learn: LearnIcon,
  Magazine: MagazineIcon,
  Shop: ShopIcon,
  Camera: Camera,
  Heart,
  Eye,
  EyeSlash: EyeOff,
  Grid: LayoutGrid,
  Link: LinkIcon,
  Check,
  Twitter,
  Message: MessageCircle,
  Instagram,
  Download,
  Filter: SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Bag: ShoppingBag,
  List,
  Menu: MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash,
  Plus,
  Sun,
  Moon,
  School: GraduationCap,
  Cup: Coffee,
  Info,
  Mail,
  Settings,
  Edit: Pencil,
  User,
  Users,
  Music,
  Image,
  ExternalLink,
  Palette,
  ZoomIn,
  Box: Package,
  Lightbulb,
  BookOpen,
  Hammer: Package,
  Send,
  Sparkles,
  Location: MapPin,
  MapPin,
  Search,
  Star,
  Home,
  Calendar,
  Coffee,
  LogOut,
  LogIn,
  Shield,
  Clock,
  Key: KeyRound,
  AlertCircle,
};
