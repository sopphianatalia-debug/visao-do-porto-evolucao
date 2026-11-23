
package br.com.visaodoporto.backend.controller;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.visaodoporto.backend.dto.AtivoRequest;
import br.com.visaodoporto.backend.dto.TrabalhadorRequest;
import br.com.visaodoporto.backend.dto.TrabalhadorResponse;
import br.com.visaodoporto.backend.dto.TrabalhadorUpdateRequest;
import br.com.visaodoporto.backend.service.TrabalhadorService;

@RestController
@RequestMapping("/api/trabalhadores")
public class TrabalhadorController {

    private final TrabalhadorService service;

    public TrabalhadorController(TrabalhadorService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrabalhadorResponse cadastrar(@Valid @RequestBody TrabalhadorRequest request) {
        try {
            return TrabalhadorResponse.de(service.cadastrar(
                request.nome(), request.matricula(), request.empresa(),
                request.setor(), request.cargo()));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @GetMapping
    public List<TrabalhadorResponse> listar() {
        return service.listar().stream().map(TrabalhadorResponse::de).toList();
    }

    @GetMapping("/{id}")
    public TrabalhadorResponse buscar(@PathVariable UUID id) {
        try {
            return TrabalhadorResponse.de(service.buscarPorId(id));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        }
    }

    @PutMapping("/{id}")
    public TrabalhadorResponse atualizar(@PathVariable UUID id,
                                         @Valid @RequestBody TrabalhadorUpdateRequest request) {
        try {
            return TrabalhadorResponse.de(service.atualizar(
                id, request.nome(), request.empresa(), request.setor(), request.cargo()));
        } catch (IllegalArgumentException ex) {
            HttpStatus status = "Trabalhador não encontrado.".equals(ex.getMessage())
                ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            throw new ResponseStatusException(status, ex.getMessage());
        }
    }

    @PatchMapping("/{id}/ativo")
    public TrabalhadorResponse alterarAtivo(@PathVariable UUID id,
                                            @Valid @RequestBody AtivoRequest request) {
        try {
            return TrabalhadorResponse.de(service.alterarAtivo(id, request.ativo()));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        }
    }
}
