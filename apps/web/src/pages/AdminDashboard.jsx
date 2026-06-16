
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trash2, Edit, Trophy, FileText, AlertTriangle, LayoutDashboard, Users, CircleDollarSign } from 'lucide-react';
import { format } from 'date-fns';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ScoreSelectorComponent from '@/components/ScoreSelectorComponent.jsx';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [apostas, setApostas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [configBolao, setConfigBolao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editingAposta, setEditingAposta] = useState(null);
  
  const [brasilScore, setBrasilScore] = useState('');
  const [marrocosScore, setMarrocosScore] = useState('');
  const [submittingPlacar, setSubmittingPlacar] = useState(false);
  const [editingPlacarFinal, setEditingPlacarFinal] = useState(false);
  const placarFinalLancado = Boolean(configBolao?.placar_final);
  const placarSomenteLeitura = placarFinalLancado && !editingPlacarFinal;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const apostasData = await pb.collection('apostas').getFullList({ sort: '-created', $autoCancel: false });
      setApostas(apostasData);

      const [logsResult, solicitacoesResult, configResult] = await Promise.allSettled([
        pb.collection('logs').getFullList({ sort: '-created', $autoCancel: false }),
        pb.collection('solicitacoes_exclusao').getFullList({ sort: '-created', $autoCancel: false }),
        pb.collection('configuracao_bolao').getFullList({ $autoCancel: false })
      ]);

      const adminRequests = [logsResult, solicitacoesResult];
      const unauthorized = adminRequests.some((result) => result.status === 'rejected' && result.reason?.status === 401);
      if (unauthorized) {
        toast.error('Sessao admin expirada. Entre novamente.');
        navigate('/admin/login', { replace: true });
        return;
      }

      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value);
      } else {
        console.error('Error fetching logs:', logsResult.reason);
        setLogs([]);
      }

      if (solicitacoesResult.status === 'fulfilled') {
        setSolicitacoes(solicitacoesResult.value);
      } else {
        console.error('Error fetching deletion requests:', solicitacoesResult.reason);
        setSolicitacoes([]);
      }

      if (configResult.status === 'fulfilled') {
        const nextConfig = configResult.value[0] || null;
        setConfigBolao(nextConfig);

        if (nextConfig?.placar_final && !editingPlacarFinal) {
          const [brasil, marrocos] = nextConfig.placar_final.split('x').map((score) => score.trim());
          setBrasilScore(brasil || '');
          setMarrocosScore(marrocos || '');
        }
      } else {
        console.error('Error fetching final score configuration:', configResult.reason);
        setConfigBolao(null);
      }

      if (adminRequests.some((result) => result.status === 'rejected')) {
        toast.error('Alguns dados administrativos nao foram carregados');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error?.status === 401) {
        toast.error('Sessao admin expirada. Entre novamente.');
        navigate('/admin/login', { replace: true });
      } else {
        toast.error('Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, nome) => {
    if (!window.confirm(`Confirma a exclusão da aposta de ${nome}?`)) return;

    try {
      await pb.collection('apostas').delete(id, { $autoCancel: false });
      await pb.collection('logs').create({
        acao: 'exclusão',
        descricao: `Aposta excluída: ${nome}`
      }, { $autoCancel: false });
      toast.success('Aposta excluída');
      fetchData();
    } catch (error) {
      console.error('Error deleting bet:', error);
      toast.error('Erro ao excluir aposta');
    }
  };

  const handleEdit = (aposta, field) => {
    setEditingAposta(aposta);
    setEditField(field);
    setEditValue(aposta[field]);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      await pb.collection('apostas').update(editingAposta.id, {
        [editField]: editValue
      }, { $autoCancel: false });

      await pb.collection('logs').create({
        acao: 'edição',
        descricao: `Aposta editada: ${editingAposta.nome} - Campo: ${editField}`
      }, { $autoCancel: false });

      toast.success('Aposta atualizada');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating bet:', error);
      toast.error('Erro ao atualizar aposta');
    }
  };

  const handleToggleStatus = async (aposta) => {
    const newStatus = aposta.status === 'pago' ? 'pendente' : 'pago';
    try {
      await pb.collection('apostas').update(aposta.id, {
        status: newStatus
      }, { $autoCancel: false });

      await pb.collection('logs').create({
        acao: 'alteração_status',
        descricao: `Status alterado: ${aposta.nome} - ${aposta.status} → ${newStatus}`
      }, { $autoCancel: false });

      toast.success('Status atualizado');
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleApproveDeletion = async (solicitacao) => {
    try {
      const aposta = apostas.find(a => a.id === solicitacao.aposta_id);
      if (aposta) {
        await pb.collection('apostas').delete(solicitacao.aposta_id, { $autoCancel: false });
        await pb.collection('logs').create({
          acao: 'exclusão',
          descricao: `Aposta excluída via solicitação: ${solicitacao.nome}`
        }, { $autoCancel: false });
      }
      await pb.collection('solicitacoes_exclusao').delete(solicitacao.id, { $autoCancel: false });
      toast.success('Solicitação aprovada e aposta excluída');
      fetchData();
    } catch (error) {
      console.error('Error approving deletion:', error);
      toast.error('Erro ao aprovar exclusão');
    }
  };

  const handleDismissDeletion = async (solicitacao) => {
    try {
      await pb.collection('solicitacoes_exclusao').delete(solicitacao.id, { $autoCancel: false });
      toast.success('Solicitação descartada');
      fetchData();
    } catch (error) {
      console.error('Error dismissing deletion:', error);
      toast.error('Erro ao descartar solicitação');
    }
  };

  const handleLancarPlacar = async () => {
    if (brasilScore === '' || marrocosScore === '') {
      toast.error('Preencha o placar completo');
      return;
    }

    const placarFinal = `${brasilScore} x ${marrocosScore}`;
    setSubmittingPlacar(true);
    
    try {
      const vencedores = apostas
        .filter(a => a.placar.toLowerCase() === placarFinal.toLowerCase())
        .map(a => a.nome);

      const configData = {
        placar_final: placarFinal,
        vencedores: vencedores
      };

      const existingConfig = await pb.collection('configuracao_bolao').getFullList({ $autoCancel: false });
      
      if (existingConfig.length > 0) {
        const updatedConfig = await pb.collection('configuracao_bolao').update(existingConfig[0].id, configData, { $autoCancel: false });
        setConfigBolao(updatedConfig);
      } else {
        const createdConfig = await pb.collection('configuracao_bolao').create(configData, { $autoCancel: false });
        setConfigBolao(createdConfig);
      }

      await pb.collection('logs').create({
        acao: 'placar_final',
        descricao: `Placar final lançado: ${placarFinal} - Vencedores: ${vencedores.length > 0 ? vencedores.join(', ') : 'Nenhum'}`
      }, { $autoCancel: false });

      toast.success(`Placar lançado! ${vencedores.length} vencedor(es) identificado(s)`);
      setEditingPlacarFinal(false);
      fetchData();
    } catch (error) {
      console.error('Error launching score:', error);
      toast.error('Erro ao lançar placar');
    } finally {
      setSubmittingPlacar(false);
    }
  };

  const handleEditarPlacarFinal = () => {
    setEditingPlacarFinal(true);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Painel Admin - Bolão Brasil x Marrocos</title>
        <meta name="description" content="Painel administrativo do Bolão Brasil x Marrocos" />
      </Helmet>
      <Header />
      <main className="app-shell min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <span className="section-kicker"><LayoutDashboard className="h-3.5 w-3.5" /> Gestão do bolão</span>
            <h1 className="mt-4 text-3xl md:text-4xl">Painel Administrativo</h1>
            <p className="mt-2 text-muted-foreground">Acompanhe apostas, pagamentos e o resultado em um só lugar.</p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users /></span>
                <div><p className="text-sm text-muted-foreground">Total de apostas</p><p className="font-[Manrope] text-2xl font-extrabold">{apostas.length}</p></div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/25 text-foreground"><CircleDollarSign /></span>
                <div><p className="text-sm text-muted-foreground">Valor acumulado</p><p className="font-[Manrope] text-2xl font-extrabold">R$ {apostas.reduce((sum, aposta) => sum + (aposta.valor || 10), 0).toFixed(2)}</p></div>
              </div>
            </Card>
          </div>

          <Card className="mb-8 border-accent/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[hsl(var(--brasil-blue))]" />
                Lançar Placar Final
              </CardTitle>
              <CardDescription>Defina o placar final de Brasil x Marrocos para identificar os vencedores</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreSelectorComponent 
                brasilScore={brasilScore}
                marrocosScore={marrocosScore}
                onBrasilChange={setBrasilScore}
                onMarrocosChange={setMarrocosScore}
                onSubmit={placarSomenteLeitura ? handleEditarPlacarFinal : handleLancarPlacar}
                disabled={submittingPlacar}
                readOnly={placarSomenteLeitura}
                submitLabel={placarSomenteLeitura ? 'Editar placar' : 'Confirmar placar'}
              />
            </CardContent>
          </Card>

          {solicitacoes.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Solicitações de Exclusão ({solicitacoes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {solicitacoes.map((sol) => (
                    <div key={sol.id} className="soft-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{sol.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(sol.created), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => handleApproveDeletion(sol)}>
                          Aprovar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDismissDeletion(sol)}>
                          Descartar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Todas as Apostas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Placar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apostas.map((aposta) => (
                      <TableRow key={aposta.id}>
                        <TableCell className="text-sm">
                          {format(new Date(aposta.created), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{aposta.nome}</TableCell>
                        <TableCell>{aposta.telefone || 'Não informado'}</TableCell>
                        <TableCell className="font-semibold text-[hsl(var(--brasil-blue))]">
                          Brasil {aposta.placar.split('x')[0]?.trim()} x {aposta.placar.split('x')[1]?.trim()} Marrocos
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={`cursor-pointer ${aposta.status === 'pago' ? 'border border-emerald-300/70 bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'border border-amber-300/70 bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                            onClick={() => handleToggleStatus(aposta)}
                          >
                            {aposta.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">R$ {(aposta.valor || 10).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(aposta, 'nome')}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(aposta, 'telefone')}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(aposta, 'placar')}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(aposta.id, aposta.nome)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {apostas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma aposta registrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Histórico de Ações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="soft-panel p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{log.acao}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created), 'dd/MM/yyyy HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-sm">{log.descricao}</p>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Nenhum log registrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editField}</DialogTitle>
            <DialogDescription>Altere o valor do campo abaixo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">Novo valor</Label>
              <Input
                id="edit-value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-foreground"
              />
              {editField === 'placar' && (
                <p className="text-xs text-muted-foreground mt-1">Formato esperado: X x Y (ex: 2 x 1)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
};

export default AdminDashboard;
