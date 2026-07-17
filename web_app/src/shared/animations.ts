import { Variants, Easing } from 'framer-motion';

const easeOut = { duration: 0.3, ease: 'easeOut' as Easing };

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const containerStagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};

export const fadeInFromTop: Variants = {
  hidden: { opacity: 0, y: -4 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeInFromRight: Variants = {
  hidden: { opacity: 0, x: 8 },
  show: { opacity: 1, x: 0, transition: { ...easeOut, delay: 0.1 } },
};
