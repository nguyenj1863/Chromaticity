import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerData {
  height: number | null;
  weight: number | null;
  age: number | null;
  gender: string;
  bmi: number | null;
  bmr: number | null;
}

interface AppState {
  player1: PlayerData;
  player2: PlayerData;
  selectedCameraDeviceId: string | null;
  cameraStream: MediaStream | null;
  setPlayer1Data: (data: Partial<PlayerData>) => void;
  setPlayer2Data: (data: Partial<PlayerData>) => void;
  setSelectedCameraDeviceId: (deviceId: string | null) => void;
  setCameraStream: (stream: MediaStream | null) => void;
  calculateBMI: (player: 1 | 2) => number | null;
}

const calculateBMI = (height: number | null, weight: number | null): number | null => {
  if (!height || !weight || height <= 0 || weight <= 0) return null;
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  return Math.round(bmi * 10) / 10; // Round to 1 decimal place
};

const calculateBMR = (
  height: number | null,
  weight: number | null,
  age: number | null,
  gender: string
): number | null => {
  if (!height || !weight || !age || !gender || height <= 0 || weight <= 0 || age <= 0) return null;
  
  // Mifflin-St Jeor Equation
  // For men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
  // For women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
  
  const baseBMR = 10 * weight + 6.25 * height - 5 * age;
  
  // Check if gender is male (case-insensitive)
  // For non-binary and other genders, use the average of male and female formulas
  const genderLower = gender.toLowerCase();
  const isMale = genderLower === 'male';
  const isFemale = genderLower === 'female';
  
  let bmr: number;
  if (isMale) {
    bmr = baseBMR + 5;
  } else if (isFemale) {
    bmr = baseBMR - 161;
  } else {
    // For non-binary and other genders, use average of male and female formulas
    bmr = baseBMR - 78; // Average of +5 and -161
  }
  
  return Math.round(bmr); // Round to nearest whole number
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      player1: {
        height: null,
        weight: null,
        age: null,
        gender: '',
        bmi: null,
        bmr: null,
      },
      player2: {
        height: null,
        weight: null,
        age: null,
        gender: '',
        bmi: null,
        bmr: null,
      },
      selectedCameraDeviceId: null,
      cameraStream: null,
      setSelectedCameraDeviceId: (deviceId) => set({ selectedCameraDeviceId: deviceId }),
      setCameraStream: (stream) => set({ cameraStream: stream }),
      setPlayer1Data: (data) => {
        const player1 = { ...get().player1, ...data };
        const bmi = calculateBMI(player1.height, player1.weight);
        const bmr = calculateBMR(player1.height, player1.weight, player1.age, player1.gender);
        set({ player1: { ...player1, bmi, bmr } });
      },
      setPlayer2Data: (data) => {
        const player2 = { ...get().player2, ...data };
        const bmi = calculateBMI(player2.height, player2.weight);
        const bmr = calculateBMR(player2.height, player2.weight, player2.age, player2.gender);
        set({ player2: { ...player2, bmi, bmr } });
      },
      calculateBMI: (player) => {
        const playerData = player === 1 ? get().player1 : get().player2;
        return calculateBMI(playerData.height, playerData.weight);
      },
    }),
    {
      name: 'chromacity-storage',
      partialize: (state) => ({
        // Only persist player data and device ID, not the camera stream
        player1: state.player1,
        player2: state.player2,
        selectedCameraDeviceId: state.selectedCameraDeviceId,
        // cameraStream is not persisted (not serializable)
      }),
    }
  )
);

