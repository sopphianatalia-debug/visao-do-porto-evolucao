package br.com.visaodoporto.backend.dto;

import jakarta.validation.constraints.NotNull;

public record AtivoRequest(@NotNull Boolean ativo) {}
