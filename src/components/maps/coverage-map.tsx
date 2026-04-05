"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

import { Card, CardContent } from "@/components/ui/card";
import type { CoveragePoint } from "@/types/domain";

function colorFromStatus(status: CoveragePoint["status"]) {
  if (status === "approved") {
    return "#22c55e";
  }

  if (status === "flagged") {
    return "#f59e0b";
  }

  return "#b678f8";
}

export function CoverageMap({ points }: { points: CoveragePoint[] }) {
  if (!points.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No geo-tagged field records are available yet. When enumerators capture locations during
          surveys, the coverage map will populate automatically.
        </CardContent>
      </Card>
    );
  }

  const center = points[0]
    ? ([points[0].latitude, points[0].longitude] as [number, number])
    : ([28.5355, 77.391] as [number, number]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Geo-tagged coverage map</h3>
            <p className="text-sm text-muted-foreground">
              Geo-tagged submissions are plotted against district coverage activity.
            </p>
          </div>
          <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium">
            {points.length} map points
          </div>
        </div>
        <div className="h-[520px] overflow-hidden rounded-[2rem]">
          <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((point) => (
              <CircleMarker
                key={point.id}
                center={[point.latitude, point.longitude]}
                radius={12}
                pathOptions={{
                  color: colorFromStatus(point.status),
                  fillColor: colorFromStatus(point.status),
                  fillOpacity: 0.7
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{point.householdId}</p>
                    <p>{point.enumeratorName}</p>
                    <p>{point.scope.district} / {point.scope.block}</p>
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
