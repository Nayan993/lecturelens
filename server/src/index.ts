import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(
    `LectureLens API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`,
  );
});
