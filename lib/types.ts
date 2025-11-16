// IMU data type definition

export interface IMUData {
  time_ms: number;
  walking_speed?: number;
  aiming_angle_deg?: number;
  accel_g?: [number, number, number]; // [x, y, z] acceleration in g-forces
  angularv_rad_s?: [number, number, number]; // [x, y, z] angular velocity in rad/s
  roll_deg?: number;
  yaw_deg?: number;
}

