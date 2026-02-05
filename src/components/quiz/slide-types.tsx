import React from 'react';
import { 
  ListOrdered, 
  MessageSquare, 
  Lightbulb, 
  LayoutGrid, 
  BarChart2, 
  Puzzle, 
  Link2, 
  MapPin, 
  Film,
  FileText,
  Award,
} from 'lucide-react';
import { SlideType, ActivityType, ToolType } from '../../types/quiz';

// Custom SVG Icons from Design
const InfoIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg width="42" height="39" viewBox="0 0 42 39" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M26.3688 -0.000488281H15.2886C6.87188 -0.000488281 0 6.85068 0 15.242C0 21.5621 3.83547 26.9793 9.32232 29.3162C7.13823 34.9989 3.03641 38.2386 3.03641 38.2386C3.03641 38.2386 12.4653 38.2386 19.0175 30.5377H26.3688C34.8388 30.5377 41.6575 23.6865 41.6575 15.2952C41.6575 6.90379 34.7856 -0.000488281 26.3688 -0.000488281Z" fill="currentColor"/>
      <path d="M12.3592 17.7384C13.7419 17.7384 14.8629 16.6209 14.8629 15.2423C14.8629 13.8637 13.7419 12.7461 12.3592 12.7461C10.9764 12.7461 9.85547 13.8637 9.85547 15.2423C9.85547 16.6209 10.9764 17.7384 12.3592 17.7384Z" fill="white"/>
      <path d="M21.2557 17.7384C22.6384 17.7384 23.7594 16.6209 23.7594 15.2423C23.7594 13.8637 22.6384 12.7461 21.2557 12.7461C19.8729 12.7461 18.752 13.8637 18.752 15.2423C18.752 16.6209 19.8729 17.7384 21.2557 17.7384Z" fill="white"/>
      <path d="M30.0975 17.7384C31.4802 17.7384 32.6012 16.6209 32.6012 15.2423C32.6012 13.8637 31.4802 12.7461 30.0975 12.7461C28.7147 12.7461 27.5938 13.8637 27.5938 15.2423C27.5938 16.6209 28.7147 17.7384 30.0975 17.7384Z" fill="white"/>
    </g>
  </svg>
);

const ActivityIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M33.7129 30.5653C39.4335 28.1289 43.4324 22.4809 43.4324 15.8915C43.4324 7.08723 36.2677 -0.000488281 27.4924 -0.000488281H15.94C7.16468 -0.000488281 0 7.1426 0 15.8915C0 24.6404 7.16468 31.7835 15.94 31.7835H23.6046C30.436 39.8125 40.2666 39.8125 40.2666 39.8125C40.2666 39.8125 35.99 36.4902 33.7129 30.5099V30.5653Z" fill="currentColor"/>
      <path d="M20.1652 17.9929C20.1652 14.006 24.7195 13.6184 24.7195 10.9052C24.7195 9.85308 23.942 8.30264 21.8314 8.30264C19.6098 8.30264 18.7767 10.0746 18.8323 11.5143C18.8323 12.511 18.3324 13.5631 16.9439 13.5631C15.5554 13.5631 15 12.511 15 11.5143C15 7.3613 18.499 5.03564 21.887 5.03564C25.2749 5.03564 28.5518 7.19518 28.5518 10.9605C28.5518 15.2242 24.1086 14.9474 24.1086 17.9375C24.1086 18.9342 23.4421 19.9309 22.1091 19.9309C20.7762 19.9309 20.1097 18.9342 20.1097 17.9375L20.1652 17.9929ZM22.1091 21.3152C23.2755 21.3152 24.2752 22.3119 24.2752 23.4748C24.2752 24.6376 23.2755 25.6897 22.1091 25.6897C20.9428 25.6897 19.8875 24.693 19.8875 23.4748C19.8875 22.2566 20.8873 21.3152 22.1091 21.3152Z" fill="white"/>
    </g>
  </svg>
);

const ToolsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg width="41" height="35" viewBox="0 0 41 35" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M31.2553 26.0598L29.3302 19.4128C29.0428 18.199 30.5083 17.043 31.7151 18.0545C31.83 18.1412 31.9162 18.199 32.0024 18.2568C33.0656 19.0949 34.4448 19.4995 35.8528 19.2683C38.5825 18.8348 40.4502 16.2338 40.0192 13.4883C39.5882 10.7428 37.0022 8.86435 34.2724 9.29785C32.9219 9.52905 31.83 10.3093 31.0829 11.3208C30.9967 11.4075 30.8818 11.5231 30.7381 11.7543C29.9048 13.1415 28.0946 12.4479 28.0371 11.1474L27.7785 3.89357C27.6923 1.46598 25.5085 -0.325812 23.1236 0.0498867L16.2562 1.14808C16.2562 1.14808 15.1068 1.20588 15.3654 2.76648C15.4516 3.40227 16.4861 3.98027 16.4861 3.98027C17.4055 4.78947 18.009 5.88766 18.2101 7.10146C18.6124 9.67355 16.8883 12.1011 14.331 12.5346L13.9575 12.5924C11.3714 13.0259 8.92901 11.2919 8.498 8.69095L8.44053 8.31525C8.26812 7.33266 8.38306 6.32116 8.78533 5.39636C8.78533 5.39636 9.56115 4.26927 9.47495 3.74907C9.24508 2.27518 7.77964 2.50638 7.77964 2.50638L3.41207 3.19997C1.17082 3.66237 -0.294618 5.74316 0.0501905 7.93955L3.72815 31.0306C4.07295 33.2269 6.1418 34.7297 8.32559 34.3829L28.0371 31.204C30.4221 30.8283 31.9162 28.4296 31.2553 26.0887V26.0598Z" fill="currentColor"/>
  </svg>
);

export type ActivityCategory = 'evaluable' | 'non-evaluable' | 'live';

export interface SlideTypeOption {
  id: string;
  type: SlideType;
  activityType?: ActivityType;
  toolType?: ToolType;
  category?: ActivityCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export const SLIDE_TYPES: SlideTypeOption[] = [
  // Info slides
  {
    id: 'info',
    type: 'info',
    label: 'Informace',
    icon: <InfoIcon />,
    color: '#4E5871',
    description: 'Text, obrázky, video',
  },
  // EVALUABLE ACTIVITIES (Green)
  {
    id: 'abc',
    type: 'activity',
    activityType: 'abc',
    category: 'evaluable',
    label: 'ABC otázka',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Výběr z možností',
  },
  {
    id: 'example',
    type: 'activity',
    activityType: 'example',
    category: 'evaluable',
    label: 'Příklad',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Řešený příklad',
  },
  {
    id: 'connect-pairs',
    type: 'activity',
    activityType: 'connect-pairs',
    category: 'evaluable',
    label: 'Spojovačka',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Propojování dvojic',
  },
  {
    id: 'fill-blanks',
    type: 'activity',
    activityType: 'fill-blanks',
    category: 'evaluable',
    label: 'Doplňování',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Slova do mezer',
  },
  {
    id: 'image-hotspots',
    type: 'activity',
    activityType: 'image-hotspots',
    category: 'evaluable',
    label: 'Poznávačka',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Body na obrázku',
  },
  {
    id: 'video-quiz',
    type: 'activity',
    activityType: 'video-quiz',
    category: 'evaluable',
    label: 'Video kvíz',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Otázky ve videu',
  },
  // NON-EVALUABLE ACTIVITIES (Purple)
  {
    id: 'open',
    type: 'activity',
    activityType: 'open',
    category: 'non-evaluable',
    label: 'Otevřená',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Textová odpověď',
  },
  {
    id: 'form',
    type: 'activity',
    activityType: 'form',
    category: 'non-evaluable',
    label: 'Formulář',
    icon: <FileText className="w-5 h-5" />,
    color: '#03CA90',
    description: 'Vlastní formulář s poli',
  },
  // LIVE ACTIVITIES (Red)
  {
    id: 'board',
    type: 'activity',
    activityType: 'board',
    category: 'live',
    label: 'Nástěnka',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Společná zeď studentů',
  },
  {
    id: 'voting',
    type: 'activity',
    activityType: 'voting',
    category: 'live',
    label: 'Hlasování',
    icon: <ActivityIcon />,
    color: '#03CA90',
    description: 'Průzkum a zpětná vazba',
  },
  // Tool slides
  {
    id: 'certificate',
    type: 'tools',
    toolType: 'certificate',
    label: 'Certifikát',
    icon: <Award className="w-5 h-5" />,
    color: '#FF8158',
    description: 'Certifikát pro účastníky',
  },
];
