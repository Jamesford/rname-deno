import ky from "ky";
import { getConfig } from "../config.ts";

type TmdbApiShowResult = {
  adult: boolean;
  backdrop_path: string | null;
  created_by: {
    id: number;
    credit_id: string;
    name: string;
    gender: number;
    profile_path: string | null;
  }[];
  episode_run_time: number[];
  first_air_date: string;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string;
  id: number;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: {
    air_date: string;
    episode_number: number;
    id: number;
    name: string;
    overview: string;
    production_code: string;
    season_number: number;
    still_path: string | null;
    vote_average: number; // float
    vote_count: number;
  };
  name: string;
  next_episode_to_air: null;
  networks: {
    name: string;
    id: number;
    logo_path: string | null;
    origin_country: string;
  }[];
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number; // float
  poster_path: string | null;
  production_companies: {
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
  }[];
  production_countries: {
    iso_3166_1: string;
    name: string;
  }[];
  seasons: {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
  }[];
  spoken_languages: {
    english_name: string;
    iso_639_1: string;
    name: string;
  }[];
  status: string;
  tagline: string;
  type: string;
  vote_average: number; // float
  vote_count: number;
};

type TmdbApiShowSearchResult = {
  poster_path: string | null;
  popularity: number; // float
  id: number;
  backdrop_path: string | null;
  vote_average: number; // float
  overview: string;
  first_air_date: string;
  origin_country: string[];
  genre_ids: number[];
  original_language: string;
  vote_count: number;
  name: string;
  original_name: string;
};

export type TmdbShow = {
  id: number;
  name: string;
  overview: string;
  year: string;
};

function trimShowResult(
  result: TmdbApiShowResult | TmdbApiShowSearchResult,
): TmdbShow {
  return {
    id: result.id,
    name: result.name,
    overview: result.overview,
    year: result.first_air_date?.substring(0, 4),
  };
}

export async function getShowById(id: string): Promise<TmdbShow> {
  const { apiKey } = await getConfig();

  const result: TmdbApiShowResult = await ky.get(
    `https://api.themoviedb.org/3/tv/${id}`,
    {
      searchParams: {
        api_key: apiKey,
        language: "en-US",
      },
    },
  ).then((r) => r.json());

  return trimShowResult(result);
}

export async function getShowsByQuery(query: string): Promise<TmdbShow[]> {
  const { apiKey } = await getConfig();

  const { results }: { results: TmdbApiShowSearchResult[] } = await ky.get(
    "https://api.themoviedb.org/3/search/tv",
    {
      searchParams: {
        api_key: apiKey,
        language: "en-US",
        include_adult: true,
        page: 1,
        query,
      },
    },
  ).then((r) => r.json());

  return results.map(trimShowResult);
}

// https://developers.themoviedb.org/3/tv-seasons/get-tv-season-details
type TmdbApiEpisodeResult = {
  air_date: string;
  episode_number: number;
  crew: Record<string, null | string | number | boolean>[];
  guest_stars: Record<string, null | string | number | boolean>[];
  id: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  still_path: string;
  vote_average: number; // float
  vote_count: number;
};

export async function getShowEpisodeTitles(
  id: number,
  season: number,
): Promise<Record<string, string>> {
  const { apiKey } = await getConfig();

  const { episodes }: { episodes: TmdbApiEpisodeResult[] } = await ky.get(
    `https://api.themoviedb.org/3/tv/${id}/season/${season}`,
    {
      searchParams: {
        api_key: apiKey,
        language: "en-US",
      },
    },
  ).then((r) => r.json());

  return episodes.reduce((namesByEpisode, { episode_number, name }) => ({
    [episode_number]: name,
    ...namesByEpisode,
  }), {});
}
