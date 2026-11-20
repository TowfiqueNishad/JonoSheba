"""Versioned YAML Prompt Registry for Jonoshheba AI."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]


@dataclass(frozen=True)
class PromptSpec:
    id: str
    version: str
    inputs: list[str]
    eval_set: str
    template: str

    def render(self, variables: dict[str, str]) -> str:
        text = self.template
        for key in self.inputs:
            if key not in variables:
                raise ValueError(f"Missing prompt variable '{key}' for {self.id}@{self.version}")
            text = text.replace(f"{{{{{key}}}}}", variables[key])
        return text


class PromptRegistry:
    def __init__(self, prompts_dir: Path | None = None) -> None:
        self._dir = prompts_dir or (Path(__file__).resolve().parent.parent / "prompts")
        self._cache: dict[str, PromptSpec] = {}
        self.reload()

    def reload(self) -> None:
        self._cache.clear()
        if not self._dir.exists():
            return
        for yaml_file in sorted(self._dir.glob("*.yaml")):
            raw: dict[str, Any] = yaml.safe_load(yaml_file.read_text(encoding="utf-8")) or {}
            spec = PromptSpec(
                id=str(raw["id"]),
                version=str(raw["version"]),
                inputs=[str(x) for x in raw.get("inputs", [])],
                eval_set=str(raw.get("eval_set", "default")),
                template=str(raw["template"]),
            )
            self._cache[f"{spec.id}@{spec.version}"] = spec
            self._cache[spec.id] = spec

    def get(self, prompt_id: str, version: str | None = None) -> PromptSpec:
        key = f"{prompt_id}@{version}" if version else prompt_id
        if key not in self._cache:
            raise KeyError(f"Prompt '{key}' not found in registry")
        return self._cache[key]

    def list_prompts(self) -> list[dict[str, str]]:
        seen: set[tuple[str, str]] = set()
        items: list[dict[str, str]] = []
        for spec in self._cache.values():
            pair = (spec.id, spec.version)
            if pair not in seen:
                seen.add(pair)
                items.append({"id": spec.id, "version": spec.version, "eval_set": spec.eval_set})
        return items


prompt_registry = PromptRegistry()
