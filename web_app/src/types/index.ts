export type BinStatus = 'optimal' | 'high' | 'critical';

export interface WasteBin {
  id: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  fillLevel: number; // 0-100
  lastCollection: string;
  status: BinStatus;
  battery: number;
}

export interface CollectionTruck {
  id: string;
  driverName: string;
  status: 'active' | 'idle' | 'maintenance';
  currentLoad: number;
  location: {
    lat: number;
    lng: number;
  };
}

export interface DashboardStats {
  totalBins: number;
  criticalBins: number;
  activeTrucks: number;
  totalCollectedToday: number; // kg or tons
}
