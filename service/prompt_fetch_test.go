package service

import "testing"

func TestParseRegistryPrompts(t *testing.T) {
	items, err := parseRegistryPrompts(`[
		{"id":"banana:1","title":"海报","prompt":"生成海报","coverUrl":"https://example.com/cover.png","referenceImageUrls":["https://example.com/ref.png"],"tags":["海报"],"createdAt":"2026-01-06T14:40:05+08:00"},
		{"id":"banana:invalid","title":"无提示词","prompt":""}
	]`)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "banana:1" || items[0].Preview == "" || len(items[0].Tags) != 1 {
		t.Fatalf("unexpected registry prompts: %#v", items)
	}
}
