import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getWeekDates(startDate: Date): Date[] {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function getMonday(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
}

export function formatWeekRange(startDate: Date): string {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const start = startDate.toLocaleDateString('es-AR', options);
  const end = endDate.toLocaleDateString('es-AR', options);
  
  return `${start} - ${end}`;
}

export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function formatEnhancedWeekRange(startDate: Date): { 
  range: string; 
  monthContext: string;
} {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.toLocaleDateString('es-AR', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('es-AR', { month: 'short' });
  const year = startDate.getFullYear();
  
  // Format the date range
  const range = startMonth === endMonth 
    ? `${startDay} - ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  
  // Month context (if spanning multiple months)
  const monthContext = startMonth === endMonth 
    ? `${startMonth} ${year}`
    : `${startMonth} - ${endMonth} ${year}`;
  
  return { range, monthContext };
}

export function getDayName(date: Date): string {
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  return days[date.getDay()];
}

export function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}
