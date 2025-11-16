import snowflake from "snowflake-sdk";

const {
  SNOWFLAKE_ACCOUNT,
  SNOWFLAKE_USERNAME,
  SNOWFLAKE_PASSWORD,
  SNOWFLAKE_WAREHOUSE,
  SNOWFLAKE_DATABASE,
  SNOWFLAKE_SCHEMA,
  SNOWFLAKE_ROLE,
  SNOWFLAKE_CALORIES_TABLE,
} = process.env;

const isConfigured =
  !!SNOWFLAKE_ACCOUNT &&
  !!SNOWFLAKE_USERNAME &&
  !!SNOWFLAKE_PASSWORD &&
  !!SNOWFLAKE_WAREHOUSE &&
  !!SNOWFLAKE_DATABASE &&
  !!SNOWFLAKE_SCHEMA &&
  !!SNOWFLAKE_CALORIES_TABLE;

interface CalorieLog {
  sessionId: string;
  eventTime: Date;
  deltaCalories: number;
  totalCalories: number;
}

function createConnection() {
  if (!isConfigured) {
    throw new Error("Snowflake environment variables are not fully configured.");
  }

  return snowflake.createConnection({
    account: SNOWFLAKE_ACCOUNT,
    username: SNOWFLAKE_USERNAME,
    password: SNOWFLAKE_PASSWORD,
    warehouse: SNOWFLAKE_WAREHOUSE,
    database: SNOWFLAKE_DATABASE,
    schema: SNOWFLAKE_SCHEMA,
    role: SNOWFLAKE_ROLE,
  });
}

function execute<T = any>(sqlText: string, binds: any[] = []): Promise<T[]> {
  const connection = createConnection();

  return new Promise((resolve, reject) => {
    connection.connect((connectErr) => {
      if (connectErr) {
        reject(connectErr);
        return;
      }

      connection.execute({
        sqlText,
        binds,
        complete: (err, _stmt, rows) => {
          connection.destroy((destroyErr) => {
            if (destroyErr) {
              console.error("Failed to close Snowflake connection:", destroyErr);
            }
          });

          if (err) {
            reject(err);
          } else {
            resolve((rows as T[]) ?? []);
          }
        },
      });
    });
  });
}

export async function insertCalorieLog(log: CalorieLog) {
  if (!isConfigured) {
    console.warn("Snowflake is not configured; skipping calorie log insert.");
    return;
  }

  const sqlText = `
    INSERT INTO ${SNOWFLAKE_DATABASE}.${SNOWFLAKE_SCHEMA}.${SNOWFLAKE_CALORIES_TABLE}
      (SESSION_ID, EVENT_TIME, CALORIES_DELTA, CALORIES_TOTAL)
    VALUES (?, ?, ?, ?)
  `;

  await execute(sqlText, [
    log.sessionId,
    log.eventTime.toISOString(),
    log.deltaCalories,
    log.totalCalories,
  ]);
}

export async function fetchRecentCalories(limit = 120) {
  if (!isConfigured) {
    console.warn("Snowflake is not configured; returning empty calorie data.");
    return [];
  }

  const sqlText = `
    SELECT SESSION_ID, EVENT_TIME, CALORIES_TOTAL, CALORIES_DELTA
    FROM ${SNOWFLAKE_DATABASE}.${SNOWFLAKE_SCHEMA}.${SNOWFLAKE_CALORIES_TABLE}
    ORDER BY EVENT_TIME DESC
    LIMIT ${limit}
  `;

  const rows = await execute<{
    SESSION_ID: string;
    EVENT_TIME: string;
    CALORIES_TOTAL: number;
    CALORIES_DELTA: number;
  }>(sqlText);

  return rows.map((row) => ({
    sessionId: row.SESSION_ID,
    eventTime: row.EVENT_TIME,
    caloriesTotal: row.CALORIES_TOTAL,
    caloriesDelta: row.CALORIES_DELTA,
  }));
}

export async function fetchSessionSummaries(limit = 20) {
  if (!isConfigured) {
    console.warn("Snowflake is not configured; returning empty session summaries.");
    return [];
  }

  const sqlText = `
    SELECT SESSION_ID,
           MIN(EVENT_TIME) AS START_TIME,
           MAX(EVENT_TIME) AS END_TIME,
           MAX(CALORIES_TOTAL) AS TOTAL_CALORIES,
           SUM(CALORIES_DELTA) AS DELTA_CALORIES
    FROM ${SNOWFLAKE_DATABASE}.${SNOWFLAKE_SCHEMA}.${SNOWFLAKE_CALORIES_TABLE}
    GROUP BY SESSION_ID
    ORDER BY END_TIME DESC
    LIMIT ${limit}
  `;

  const rows = await execute<{
    SESSION_ID: string;
    START_TIME: string;
    END_TIME: string;
    TOTAL_CALORIES: number;
    DELTA_CALORIES: number;
  }>(sqlText);

  return rows.map((row) => ({
    sessionId: row.SESSION_ID,
    startTime: row.START_TIME,
    endTime: row.END_TIME,
    totalCalories: row.TOTAL_CALORIES,
    deltaCalories: row.DELTA_CALORIES,
  }));
}

export const snowflakeReady = isConfigured;

