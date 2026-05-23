import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"
import DESCRIPTION from "./weather.txt"

export const Parameters = Schema.Struct({
  location: Schema.optional(Schema.String).annotate({
    description: 'City name (e.g. "New York" or "London, UK"). Defaults to IP-based location.',
  }),
})

export const WeatherTool = Tool.define(
  "weather",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { location?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const loc = params.location ? encodeURIComponent(params.location) : ""
          const url = `https://wttr.in/${loc}?format=j1`
          const request = HttpClientRequest.get(url)
          const response = yield* http.execute(request)
          const arrayBuffer = yield* response.arrayBuffer
          const text = new TextDecoder().decode(arrayBuffer)
          const data = JSON.parse(text)
          const current = data.current_condition?.[0]
          if (!current) {
            return {
              title: "Weather",
              metadata: {} as Record<string, unknown>,
              output: "Could not fetch weather data.",
            }
          }
          const nearest = data.nearest_area?.[0]
          const area = nearest
            ? [nearest.areaName?.[0]?.value, nearest.region?.[0]?.value, nearest.country?.[0]?.value]
                .filter(Boolean)
                .join(", ")
            : params.location ?? "Unknown"
          const output = [
            `Location: ${area}`,
            `Temperature: ${current.temp_C}°C (${current.temp_F}°F)`,
            `Feels like: ${current.FeelsLikeC}°C`,
            `Conditions: ${current.weatherDesc?.[0]?.value ?? "Unknown"}`,
            `Humidity: ${current.humidity}%`,
            `Wind: ${current.winddir16Point} ${current.windspeedKmph} km/h`,
            `Visibility: ${current.visibility} km`,
            `UV Index: ${current.uvIndex}`,
          ].join("\n")
          return {
            title: `Weather: ${area}`,
            metadata: { location: area, temp: current.temp_C } as Record<string, unknown>,
            output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
