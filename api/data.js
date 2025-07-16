// Vercel Edge Function to serve cached data from GitHub
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    // For private repos, we need to use GitHub API with authentication
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    let response;
    
    if (GITHUB_TOKEN) {
      // Use GitHub API for private repo access
      response = await fetch(
        'https://api.github.com/repos/MaximCincinnatis/TORUS/contents/public/data/cached-data.json',
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw',
          },
        }
      );
    } else {
      // Fallback to raw URL (only works for public repos)
      response = await fetch(
        'https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/public/data/cached-data.json',
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
    }

    if (!response.ok) {
      throw new Error(`GitHub responded with ${response.status}`);
    }

    const data = await response.json();

    // Return with appropriate headers
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
        'X-Data-Source': 'github-raw',
        'X-Last-Updated': data.lastUpdated || new Date().toISOString(),
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch data',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}