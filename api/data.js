// Vercel Edge Function to serve cached data from GitHub
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    // Fetch the latest data from GitHub
    const response = await fetch(
      'https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/public/data/cached-data.json',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

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