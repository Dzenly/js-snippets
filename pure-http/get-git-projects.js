// Gets all project HTTPS path to clone from self-hosted gitlab. Here gitlab is hardcoded, so script presented as is.

const https = require('https');

if (!process.env.GITLAB_TOKEN) {
  console.error('Set GITLAB_TOKEN env variable');
  process.exit(1);
}

if (!process.env.GITLAB_PASSWORD) {
  console.error('Set GITLAB_PASSWORD env variable');
  process.exit(1);
}

async function httpsReq(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = https.request(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`STATUS: ${res.statusCode}\nHEADERS: ${JSON.stringify(res.headers)}`));
      }

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        chunks.push(...chunk);

        // console.log(chunk);
      });

      res.on('end', () => {
        const str = chunks.join('');
        let arr = [];
        try {
          arr = JSON.parse(str);
          if (!Array.isArray(arr)) {
            reject(new Error(`Not Array at JSON.parse: ${arr}`));
          }
        } catch (e) {
          reject(new Error(`Error at JSON parsing (${e.cause}) for ${str}`));
        }

        // slice to remove 'https://'
        const mappedArr = arr.map((item) => item.http_url_to_repo.slice(8));
        const linksArr = (res.headers.link || '')
          .split(',');

        let nextLink = null;
        const nextLinkArr = linksArr.filter((item) => item.includes('rel="next"'));

        if (nextLinkArr.length > 0) {
          nextLink = nextLinkArr[0]
            .split(';')[0].trim()
            .slice(1, -1);
        } else {
          nextLink = null;
        }

        resolve({
          arr: mappedArr,
          nextLink,
        });
      });
    });

    req.on('error', (e) => {
      reject(new Error(`problem with request: ${e.message}`));
    });

    req.end();
  });
}

async function getProjects() {
  const outResult = [];
  const pageSize = 100;
  const query = [
    `private_token=${process.env.GITLAB_TOKEN}`,
    'simple=true',
    'order_by=id',
    'pagination=keyset',
    'sort=asc',
    `per_page=${pageSize}`,
  ].join('&');

  let url = `https://git.rvision.pro/api/v4/projects?${query}`;

  let curPageResult = [];
  do {
    curPageResult = await httpsReq(url);
    outResult.push(...curPageResult.arr);
    url = curPageResult.nextLink;
  } while (url);

  console.log(
    outResult
      .sort()
      .map((item) => `https://git-stats-bot:${process.env.GITLAB_PASSWORD}@${item}`).join(',\n')
  );
}

getProjects();
