import https, { RequestOptions } from 'https';

export interface HttpRequestOptions extends RequestOptions {
  protocol?: string;
}

export const httpRequest = (options: HttpRequestOptions, body?: string | Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        const statusCode = res.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          const error = new Error(`HTTP ${statusCode}: ${responseBody}`);
          return reject(error);
        }
        resolve(responseBody);
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(body);
    }

    req.end();
  });
};
