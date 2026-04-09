"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { Card, CardContent } from "@/components/ui/card";
import type { CampaignGeoPoint } from "@/types/campaign";

export function CampaignGeoMap({ points }: { points: CampaignGeoPoint[] }) {
  if (!points.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Response map points will appear here after employee or public submissions capture location.
        </CardContent>
      </Card>
    );
  }

  const center = [points[0]!.latitude, points[0]!.longitude] as [number, number];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Response map</h3>
            <p className="text-sm text-muted-foreground">
              Employee proof points and public submissions with shared location are plotted below.
            </p>
          </div>
          <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium">
            {points.length} points
          </div>
        </div>
        <div className="h-[420px] overflow-hidden rounded-[2rem]">
          <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((point) => (
              <CircleMarker
                key={point.responseId}
                center={[point.latitude, point.longitude]}
                radius={10}
                pathOptions={{
                  color: "#0f766e",
                  fillColor: "#14b8a6",
                  fillOpacity: 0.75
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{point.campaignName}</p>
                    <p>{point.participantLabel}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">
                      {point.channel === "employee" ? "Employee" : "Public"}
                    </p>
                    {typeof point.accuracy === "number" ? (
                      <p>Accuracy: ±{Math.round(point.accuracy)}m</p>
                    ) : null}
                    <p suppressHydrationWarning>{new Date(point.submittedAt).toLocaleString()}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
