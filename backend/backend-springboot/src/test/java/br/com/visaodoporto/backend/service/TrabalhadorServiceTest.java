
package br.com.visaodoporto.backend.service;

import br.com.visaodoporto.backend.entity.Trabalhador;
import br.com.visaodoporto.backend.repository.TrabalhadorRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrabalhadorServiceTest {

    private TrabalhadorRepository repository;
    private TrabalhadorService service;

    @BeforeEach
    void configurar() {
        repository = mock(TrabalhadorRepository.class);
        service = new TrabalhadorService(repository);
    }

    @Test
    void deveCadastrarTrabalhador() {

        when(repository.save(any(Trabalhador.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Trabalhador trabalhador = service.cadastrar(
            "João Silva",
            "PORTO-001",
            "Operadora Portuária A"
        );

        assertEquals("João Silva", trabalhador.getNome());
        assertEquals("PORTO-001", trabalhador.getMatricula());
        assertTrue(trabalhador.isAtivo());

        verify(repository).save(any(Trabalhador.class));
    }

    @Test
    void naoDeveCadastrarMatriculaDuplicada() {

        when(repository.existsByMatricula("PORTO-001"))
            .thenReturn(true);

        assertThrows(
            IllegalArgumentException.class,
            () -> service.cadastrar(
                "João Silva",
                "PORTO-001",
                "Operadora Portuária A"
            )
        );

        verify(repository, never()).save(any());
    }

    @Test
    void deveCadastrarComSetorECargo() {
        when(repository.save(any(Trabalhador.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Trabalhador t = service.cadastrar(
            "Maria Souza", "PORTO-002", "Operadora B", "pier_bordo", "Operadora de guindaste");

        assertEquals(br.com.visaodoporto.backend.entity.SetorPortuario.PIER_BORDO, t.getSetor());
        assertEquals("Operadora de guindaste", t.getCargo());
    }

    @Test
    void naoDeveCadastrarSetorDesconhecido() {
        assertThrows(IllegalArgumentException.class, () -> service.cadastrar(
            "Maria Souza", "PORTO-002", "Operadora B", "SETOR_INVENTADO", null));
        verify(repository, never()).save(any());
    }

    @Test
    void devePermitirDesativarEReativar() {
        Trabalhador t = new Trabalhador("João Silva", "PORTO-001", "Operadora A");
        java.util.UUID id = java.util.UUID.randomUUID();
        when(repository.findById(id)).thenReturn(java.util.Optional.of(t));
        when(repository.save(any(Trabalhador.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        assertFalse(service.alterarAtivo(id, false).isAtivo());
        assertTrue(service.alterarAtivo(id, true).isAtivo());
    }

    @Test
    void deveAtualizarDadosMantendoMatricula() {
        Trabalhador t = new Trabalhador("João Silva", "PORTO-001", "Operadora A");
        java.util.UUID id = java.util.UUID.randomUUID();
        when(repository.findById(id)).thenReturn(java.util.Optional.of(t));
        when(repository.save(any(Trabalhador.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Trabalhador r = service.atualizar(id, "João S. Lima", "Operadora C", "GUARDA_PORTUARIA", "Vigilante");

        assertEquals("João S. Lima", r.getNome());
        assertEquals("PORTO-001", r.getMatricula());
        assertEquals("Vigilante", r.getCargo());
    }
}
