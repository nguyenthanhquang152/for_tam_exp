#!/usr/bin/env python3
"""Plot the workbook's detection prevalence in the style of sample.jpeg.

Run: python -m shrimp_microbiota plot [workbook.xlsx ...]
Without workbook arguments, load DOC14, DOC28, DOC42 and DOC56 in that order.
The source is aggregated presence/absence data, not CFU or relative abundance.
"""

import csv
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # Save figures without requiring a desktop/display.
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap


from .data import BASE, GROUPS, TISSUE_NAMES, read_data, taxon_group
from .dataset import load_sources


def ordered_axes(records):
    taxa = sorted({r["Taxon"] for r in records}, key=lambda t: (
        taxon_group(t), t.split()[0] != "Vibrio", t))
    treatments = sorted({r["Treatment"] for r in records}, key=lambda value: [
        (0, int(part)) if part.isdigit() else (1, part)
        for part in re.split(r"(\d+)", value) if part
    ])
    return taxa, treatments


def prepare_matrix(records):
    """Return one time/tissue's matrix; absent or incomplete values stay NaN."""
    taxa, treatments = ordered_axes(records)
    lookup = {(r["Taxon"], r["Treatment"]): r["prevalence_pct"] for r in records}
    if len(lookup) != len(records):
        raise ValueError("Filter to one sampling time and tissue before creating a matrix.")
    matrix = np.array([[lookup.get((taxon, treatment), np.nan)
                        for treatment in treatments] for taxon in taxa], dtype=float)
    return taxa, treatments, matrix


def plot_figure(records, time, tissues):
    """Create aligned heatmaps with the reference's red scale and colored groups."""
    subset = [r for r in records if r["Time"] == time and r["Tissue"] in tissues]
    taxa, treatments = ordered_axes(records)
    labels, heading_rows, data_rows = [], {}, {}
    for group, (title, _, color) in enumerate(GROUPS):
        members = [taxon for taxon in taxa if taxon_group(taxon) == group]
        if not members:
            continue
        if labels:
            labels.append("")
        heading_rows[len(labels)] = color
        labels.append(title)
        for taxon in members:
            data_rows[taxon] = len(labels)
            labels.append(taxon)

    cmap = LinearSegmentedColormap.from_list(
        "white_red", ["#ffffff", "#fee5d9", "#fcae91", "#fb6a4a", "#cb181d"])
    cmap.set_bad("#e0e0e0")
    fig, axes = plt.subplots(1, len(tissues), squeeze=False,
                             figsize=(12 if len(tissues) == 1 else 16, 9))
    fig.subplots_adjust(left=0.34 if len(tissues) == 1 else 0.26,
                        right=0.87, bottom=0.17, top=0.78, wspace=0.14)
    fig.suptitle("Culturable microbiota in whiteleg shrimp", y=0.965,
                 fontsize=22, fontweight="bold")
    fig.text(0.5, 0.91, f"{time}  |  Shrimp positive (%)", ha="center", fontsize=16)
    fig.add_artist(plt.Line2D([0.055, 0.945], [0.875, 0.875],
                             transform=fig.transFigure, color="#82909d", linewidth=1.4))
    for panel, (ax, tissue) in enumerate(zip(axes[0], tissues)):
        rows = [r for r in subset if r["Tissue"] == tissue]
        lookup = {(r["Taxon"], r["Treatment"]): r for r in rows}
        matrix = np.full((len(labels), len(treatments)), np.nan)
        for taxon, y in data_rows.items():
            for x, treatment in enumerate(treatments):
                row = lookup.get((taxon, treatment))
                if row is not None:
                    matrix[y, x] = row["prevalence_pct"] if row["prevalence_pct"] is not None else np.nan
        heatmap = ax.imshow(matrix, cmap=cmap, vmin=0, vmax=100, aspect="auto",
                            interpolation="nearest")
        for y, label in enumerate(labels):
            if y in heading_rows or not label:
                ax.axhspan(y - 0.5, y + 0.5, color="white", zorder=2)
        for x in range(1, len(treatments)):
            ax.axvline(x - 0.5, color="#aaaaaa", linestyle=(0, (2, 2)), linewidth=0.7,
                       zorder=3)
        ax.set_title(TISSUE_NAMES.get(tissue, tissue), fontsize=16, fontweight="bold", pad=48)
        ax.set_xticks(range(len(treatments)), treatments, fontsize=12, fontweight="bold")
        ax.tick_params(axis="x", top=True, labeltop=True, bottom=False, labelbottom=False, length=0, pad=10)
        ax.set_yticks(range(len(labels)), labels if panel == 0 else [""] * len(labels))
        ax.tick_params(axis="y", length=0, pad=12)
        for y, tick in enumerate(ax.get_yticklabels()):
            tick.set_fontsize(11)
            tick.set_fontweight("bold" if y in heading_rows else "normal")
            tick.set_fontstyle("normal" if y in heading_rows else "italic")
            tick.set_color(heading_rows.get(y, "#111111"))
        if panel == 0:
            ax.set_ylabel("Bacterial taxa", fontsize=13, fontweight="bold", labelpad=18)
        ax.set_xlabel("Treatment", fontsize=13, fontweight="bold", labelpad=12)
        for spine in ax.spines.values():
            spine.set_visible(False)
        ax.spines["bottom"].set_visible(True)
        ax.spines["bottom"].set_color("#aaaaaa")
        # Bold divider beside the taxon-label column, matching the reference.
        ax.spines["left"].set_visible(True)
        ax.spines["left"].set_color("#c6c6c6")
        ax.spines["left"].set_linewidth(4)
        ax.spines["left"].set_bounds(min(data_rows.values()) - 0.5, len(labels) - 0.5)
    colorbar_ax = fig.add_axes([0.90, 0.48, 0.016, 0.25])
    colorbar = fig.colorbar(heatmap, cax=colorbar_ax, ticks=[0, 25, 50, 75, 100])
    colorbar.set_label("Shrimp positive (%)", fontsize=11, labelpad=9)
    colorbar.outline.set_visible(False)
    sample_sizes = {int(r["n_shrimp"]) for r in subset}
    if len(sample_sizes) == 1:
        sample_note = f"n = {sample_sizes.pop()} shrimp per treatment and tissue."
    else:
        cohorts = {(r["Tissue"], r["Treatment"]): int(r["n_shrimp"]) for r in subset}
        sample_note = "Sample sizes: " + "; ".join(
            f"{tissue}/{treatment}: n = {n}" for (tissue, treatment), n in cohorts.items())
    fig.text(0.5, 0.105, sample_note, ha="center", fontsize=11, color="#444444")
    fig.text(0.5, 0.062, "Color = 100 × n_pos / n_shrimp. Multiple taxa can occur in one shrimp.",
             ha="center", fontsize=11, color="#444444")
    fig.text(0.5, 0.032, "Detection prevalence; not bacterial density or relative abundance. Gray = missing or incomplete data.",
             ha="center", fontsize=10, color="#555555")

    # Extend the section rules through their labels, as in the reference image.
    fig.canvas.draw()
    first_ax = axes[0, 0]
    renderer = fig.canvas.get_renderer()
    label_left = min(first_ax.get_yticklabels()[y].get_window_extent(renderer).x0
                     for y in heading_rows)
    label_start = first_ax.transAxes.inverted().transform((label_left - 6, 0))[0]
    for panel, ax in enumerate(axes[0]):
        for y in heading_rows:
            ax.axhline(y + 0.5 if y == 0 else y - 0.65,
                       xmin=label_start if panel == 0 else 0, xmax=1,
                       color="#aaaaaa", linestyle=(0, (5, 3)), linewidth=1.3,
                       clip_on=False, zorder=3)
    return fig


def generate_plots(sources, output_dir):
    output_dir = Path(output_dir)
    records, metadata = load_sources(sources)
    output_dir.mkdir(parents=True, exist_ok=True)
    fields = ["Time", "Tissue", "Taxon", "Treatment", "n_shrimp", "n_pos", "freq", "prevalence_pct", "n_missing", "n_pos_observed"]
    with (output_dir / "plotted_data.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    for time in [source["time"] for source in metadata]:
        tissues = sorted({r["Tissue"] for r in records if r["Time"] == time},
                         key=lambda t: (t != "HP", t))
        panels = [[tissue] for tissue in tissues]
        if len(tissues) > 1:
            panels.append(tissues)
        for selected in panels:
            figure = plot_figure(records, time, selected)
            name = re.sub(r"[^A-Za-z0-9_-]", "_", f"{time}_{'_'.join(selected)}_prevalence")
            for extension in ("png", "pdf"):
                path = output_dir / f"{name}.{extension}"
                figure.savefig(path, dpi=300, facecolor="white", bbox_inches="tight")
                print(path)
            plt.close(figure)
    print(f"Validated and plotted {len(records)} rows; percentages = 100 * n_pos / n_shrimp.")
