import ky from "ky";
import { getConfig } from "../config.ts";
import { definesYear } from "../regex.ts";

type TmdbApiMovieResult = {
  adult: boolean;
  backdrop_path: string | null;
  belongs_to_collection:
    | null
    | Record<string, null | string | number | boolean>;
  budget: number;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string | null;
  id: number;
  imdb_id: string | null;
  original_language: string;
  original_title: string;
  overview: string | null;
  popularity: number; // float
  poster_path: string | null;
  production_companies: {
    name: string;
    id: number;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries: {
    iso_3166_1: string;
    name: string;
  }[];
  release_date: string;
  revenue: number;
  runtime: number | null;
  spoken_languages: {
    iso_639_1: string;
    name: string;
  }[];
  status: string;
  tagline: string | null;
  title: string;
  video: boolean;
  vote_average: number; // float
  vote_count: number;
};

type TmdbApiMovieSearchResult = {
  poster_path: string | null;
  adult: boolean;
  overview: string;
  release_date: string;
  genre_ids: number[];
  id: number;
  original_title: string;
  original_language: string;
  title: string;
  backdrop_path: string | null;
  popularity: number; // float
  vote_count: number;
  video: boolean;
  vote_average: number; // float
};

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  year: string;
};

function trimAPIResult(
  result: TmdbApiMovieResult | TmdbApiMovieSearchResult,
): TmdbMovie {
  return {
    id: result.id,
    title: result.title,
    overview: result.overview ? result.overview : "",
    year: result.release_date?.substring(0, 4),
  };
}

export async function getMovieByID(id: string): Promise<TmdbMovie> {
  const { apiKey } = await getConfig();

  const result: TmdbApiMovieResult = await ky.get(
    `https://api.themoviedb.org/3/movie/${id}`,
    {
      searchParams: {
        api_key: apiKey,
        language: "en-US",
      },
    },
  ).then((r) => r.json());

  return trimAPIResult(result);
}

export async function getMoviesByQuery(query: string): Promise<TmdbMovie[]> {
  const { apiKey } = await getConfig();
  if (query === "") throw new Error("empty movie search query");

  // If query contains y:YEAR, extract to search object property
  let search: { query: string; year?: string } = { query };
  const match = query.match(definesYear);
  if (match) {
    const [_, year] = match;
    search = {
      query: query.replace(definesYear, "").trim(),
      year,
    };
  }

  const { results }: { results: TmdbApiMovieSearchResult[] } = await ky
    .get("https://api.themoviedb.org/3/search/movie", {
      searchParams: {
        api_key: apiKey,
        language: "en-US",
        include_adult: true,
        page: 1,
        ...search,
      },
    })
    .then((r) => r.json());

  return results.map(trimAPIResult);
}
